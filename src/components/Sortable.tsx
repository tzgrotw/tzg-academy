import type { ReactNode } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DraggableAttributes, type DraggableSyntheticListeners,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGrip } from './icons'

export type DragHandleProps = { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners }

/** 拖曳排序清單——課程／章節／教材三層共用。只管「使用者把順序拖成怎樣」，
 *  不管 sort_no 怎麼存；呼叫端在 onReorder 裡把新順序寫回資料庫（見 commitOrder）。
 *  滑鼠/觸控/鍵盤都吃（dnd-kit 內建），手機拖得動、螢幕閱讀器也能用方向鍵搬。 */
export function SortableList<T>({ items, getId, onReorder, children }: {
  items: T[]
  getId: (item: T) => string
  onReorder: (newItems: T[]) => void
  children: (item: T, handle: DragHandleProps, index: number) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => getId(i) === active.id)
    const newIndex = items.findIndex(i => getId(i) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableRow key={getId(item)} id={getId(item)}>
            {handle => children(item, handle, i)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: (handle: DragHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.5 : 1, position: 'relative', zIndex: isDragging ? 1 : undefined,
    }}>
      {children({ attributes, listeners })}
    </div>
  )
}

/** 拖曳把手——貼在每一列前面，只有抓這裡才會觸發拖曳（不會點到列本身就整列亂動）。 */
export function DragHandle({ attributes, listeners }: DragHandleProps) {
  return (
    <span {...attributes} {...listeners} className="drag-handle" title="拖曳排序">
      <IconGrip size={16} />
    </span>
  )
}

/** 拖完的新順序寫回資料庫：sort_no 重新編號成 10,20,30…，只更新真的變動過的那幾筆。 */
export function commitOrder<T extends { sort_no: number }>(
  newOrder: T[],
  update: (item: T, sortNo: number) => void,
) {
  newOrder.forEach((item, i) => {
    const sortNo = (i + 1) * 10
    if (item.sort_no !== sortNo) update(item, sortNo)
  })
}
