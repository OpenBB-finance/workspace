import { type MouseEvent as ReactMouseEvent, useState } from "react";

export function useDrag() {
  const [startX, setStartX] = useState<number | null>(null);
  const [startY, setStartY] = useState<number | null>(null);
  const [dx, setDx] = useState<number | null>(null);
  const [dy, setDy] = useState<number | null>(null);

  const isDragging = startX !== null;

  function handleDragStart(event: ReactMouseEvent) {
    const { clientX: startX, clientY: startY } = event;
    setStartX(startX);
    setStartY(startY);

    function handleDrag(event: MouseEvent) {
      if (!event) return;
      setDx(event.clientX - startX);
      setDy(event.clientY - startY);
    }

    function handleDragStop() {
      setStartX(null);
      setStartY(null);
      setDx(null);
      setDy(null);

      window.removeEventListener("pointerup", handleDragStop);
      window.removeEventListener("pointermove", handleDrag);
    }

    window.addEventListener("pointerup", handleDragStop);
    window.addEventListener("pointermove", handleDrag);
    event.preventDefault();
  }

  return {
    handleDragStart,
    startX,
    startY,
    dx,
    dy,
    isDragging,
  };
}
