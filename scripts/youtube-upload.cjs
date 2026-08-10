#!/usr/bin/env node
/**
 * YouTube 批量上传脚本 — 自动从 Google Drive 下载视频 + 上传到 YouTube（unlisted 链接）
 * 用法: node scripts/youtube-upload.cjs
 *
 * 注意：檔名是 .cjs（不是 .js）——這個 repo 的 package.json 是 "type": "module"，
 * 這支腳本用的是 CommonJS 的 require()，副檔名不對的話 node 會直接報錯。
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const stream = require('stream');
const { promisify } = require('util');
const { google } = require('googleapis');

const pipeline = promisify(stream.pipeline);

// ═══ 配置 ═══
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/drive.readonly',
];
const TOKEN_PATH = path.join(__dirname, '../.oauth-token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../.google-credentials.json');
const MANIFEST_PATH = path.join(__dirname, '../.upload-manifest.json');
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

// Google Drive 文件夹 ID（你的课程文件夹）
const DRIVE_FOLDER_ID = '1Lm0zaXRizJS1wd9wD-Zg203E47sCm0UP';

// ═══ 认证 ═══
async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ 错误：缺少 .google-credentials.json');
    console.error('请从 Google Cloud Console 下载 OAuth 2.0 凭证文件');
    console.error('步骤：');
    console.error('1. 访问 https://console.cloud.google.com/apis/credentials');
    console.error('2. 点击「创建凭证」→「OAuth 2.0 客户端 ID」');
    console.error('3. 选择「Web 应用」');
    console.error(`4. 添加授权重定向 URI: ${REDIRECT_URI}`);
    console.error('5. 下载 JSON 文件，重命名为 .google-credentials.json');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  // 「Web 应用」凭证放在 credentials.web；「桌面应用」放在 credentials.installed——两种都吃
  const creds = credentials.web || credentials.installed;
  if (!creds) {
    console.error('❌ .google-credentials.json 格式不对——找不到 web 或 installed 欄位');
    process.exit(1);
  }
  const { client_id, client_secret } = creds;

  const auth = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    auth.setCredentials(token);
    return auth;
  }

  return getNewToken(auth);
}

// Google 已經停用「複製貼上授權碼」的 OOB 流程，改成本地開一個小 server
// 接 redirect，使用者授權完瀏覽器會自動跳回來，不用手動貼代碼。
async function getNewToken(auth) {
  const authUrl = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

  console.log('\n🔐 需要授权访问 YouTube 和 Google Drive');
  console.log('请在浏览器打开此 URL 并完成授权：', authUrl);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') { res.writeHead(404); res.end(); return }
      const err = url.searchParams.get('error');
      const authCode = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(err ? '授权失败，可以关闭这个分页了。' : '✅ 授权成功，可以关闭这个分页了。');
      server.close();
      if (err) reject(new Error(err));
      else if (authCode) resolve(authCode);
      else reject(new Error('回调网址里没有 code 参数'));
    });
    server.on('error', reject);
    server.listen(REDIRECT_PORT);
  });

  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('✅ 授权成功！Token 已保存');
  return auth;
}

// 撈一個 Drive query 的全部檔案，自動翻頁（單頁最多回 100 筆，資料夾大會被截斷）
async function listAllFiles(drive, query, fields = 'id, name, mimeType, size, webViewLink') {
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      pageSize: 100,
      orderBy: 'name',
      pageToken,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return files;
}

// ═══ 从 Google Drive 列出视频 ═══
async function listVideosFromDrive(auth) {
  const drive = google.drive({ version: 'v3', auth });
  const courses = [];

  try {
    const courseFolders = await listAllFiles(
      drive,
      `'${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );

    for (const courseFolder of courseFolders) {
      const course = { name: courseFolder.name, id: courseFolder.id, chapters: [] };

      const chapterItems = await listAllFiles(
        drive,
        `'${courseFolder.id}' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='video/mp4' or mimeType='application/pdf') and trashed=false`,
      );

      let currentChapter = null;
      const looseFiles = []; // 课程夹里没被任何章节子资料夹包住的档案（例如档案直接放课程夹底下）
      for (const item of chapterItems) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          currentChapter = { name: item.name, id: item.id, videos: [] };
          course.chapters.push(currentChapter);
        } else {
          const file = {
            name: item.name,
            id: item.id,
            mimeType: item.mimeType,
            size: parseInt(item.size || 0, 10),
            webViewLink: item.webViewLink,
          };
          if (currentChapter) currentChapter.videos.push(file);
          else looseFiles.push(file);
        }
      }
      // 没有章节子资料夹、档案直接放课程夹底下的情况——塞进一个虚拟章节，不要静默漏掉
      if (looseFiles.length > 0) {
        course.chapters.push({ name: '未分章节', id: `${courseFolder.id}-loose`, videos: looseFiles });
      }

      // 章节文件夹本身没有子内容时，代表影片/讲义直接放在章节夹里
      for (const chapter of course.chapters) {
        if (chapter.videos.length === 0) {
          const subFiles = await listAllFiles(
            drive,
            `'${chapter.id}' in parents and (mimeType='video/mp4' or mimeType='application/pdf') and trashed=false`,
          );
          chapter.videos = subFiles.map(f => ({
            name: f.name,
            id: f.id,
            mimeType: f.mimeType,
            size: parseInt(f.size || 0, 10),
          }));
        }
      }

      courses.push(course);
    }
  } catch (err) {
    console.error('❌ 获取 Drive 文件列表失败:', err);
    throw err;
  }

  return courses;
}

// ═══ 下载视频 ═══
// Drive 檔名可能含路徑分隔符或 ..，直接拼進本機路徑會有路徑穿越風險——先把檔名壓成安全字元
function safeFileName(name) {
  return name.replace(/[/\\]/g, '_').replace(/^\.+/, '_');
}

async function downloadFile(auth, fileId, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  const filePath = path.join(__dirname, '../.temp-uploads', safeFileName(fileName));

  const tempDir = path.dirname(filePath);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  console.log(`  ⬇️  下载: ${fileName}...`);
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await pipeline(res.data, fs.createWriteStream(filePath));
  console.log('  ✅ 下载完成');
  return filePath;
}

// ═══ 上传到 YouTube ═══
async function uploadToYouTube(auth, filePath, title, description) {
  const youtube = google.youtube({ version: 'v3', auth });
  console.log(`  📹 上传到 YouTube: ${title}...`);

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title,
        description: description || `课程视频：${title}`,
        tags: ['course', 'education'],
        categoryId: '27', // 教育分类
      },
      status: {
        privacyStatus: 'unlisted', // 私密链接（只有有链接的人能看）
        madeForKids: false,
      },
    },
    media: { body: fs.createReadStream(filePath) },
  });

  console.log(`  ✅ YouTube 上传完成 (ID: ${res.data.id})`);
  return res.data.id;
}

// ═══ 上传记录（Drive fileId → YouTube videoId）═══
// 重跑腳本（例如補傳漏掉的課程）不會把已經傳過的影片又下載+上傳一次。
function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch { return {}; }
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ═══ 保存到数据库 ═══
async function saveToDatabase(courses, youtubeIds) {
  // TODO: 连接到 Supabase 并保存课程数据——这部分在后续步骤实现
  console.log('\n📊 课程数据摘要：');
  console.log(JSON.stringify({ courses, youtubeIds }, null, 2));
}

// ═══ 主函数 ═══
async function main() {
  console.log('🚀 YouTube 课程批量上传\n');

  try {
    console.log('1️⃣  授权 Google 账号...');
    const auth = await authorize();
    console.log('✅ 授权成功\n');

    console.log('2️⃣  从 Google Drive 获取课程列表...');
    const courses = await listVideosFromDrive(auth);
    console.log(`✅ 找到 ${courses.length} 门课程\n`);

    console.log('📚 课程摘要：');
    for (const course of courses) {
      console.log(`  📖 ${course.name}`);
      for (const chapter of course.chapters) {
        console.log(`    📄 ${chapter.name} (${chapter.videos.length} 个文件)`);
      }
    }
    console.log();

    console.log('3️⃣  开始上传...\n');
    const manifest = loadManifest();
    const youtubeIds = { ...manifest };

    for (const course of courses) {
      for (const chapter of course.chapters) {
        for (const video of chapter.videos) {
          if (video.mimeType !== 'video/mp4') {
            console.log(`  ⏭️  跳过讲义（不上传 YouTube，另外放 Supabase Storage）: ${video.name}`);
            continue;
          }
          if (manifest[video.id]) {
            console.log(`  ⏭️  已经上传过，跳过: ${video.name} (YouTube ID: ${manifest[video.id]})`);
            continue;
          }
          let filePath;
          try {
            filePath = await downloadFile(auth, video.id, video.name);
            const youtubeId = await uploadToYouTube(
              auth,
              filePath,
              `${course.name} - ${chapter.name} - ${video.name}`,
              `课程：${course.name}\n章节：${chapter.name}`,
            );
            youtubeIds[video.id] = youtubeId;
            manifest[video.id] = youtubeId;
            saveManifest(manifest); // 每传完一支就存档——中途断掉也不会丢进度
          } catch (err) {
            console.error(`  ❌ 上传失败: ${video.name}`, err.message);
          } finally {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }
      }
    }

    console.log('\n4️⃣  保存到数据库...');
    await saveToDatabase(courses, youtubeIds);

    console.log('\n✅ 全部完成！');
    console.log('\n📋 YouTube 视频 ID 映射：');
    console.log(JSON.stringify(youtubeIds, null, 2));
  } catch (err) {
    console.error('❌ 错误:', err);
    process.exit(1);
  }
}

main();
