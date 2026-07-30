import { useEffect } from 'react'
import type { ReactNode } from 'react'

/**
 * Fondo oscurecido de un modal. El clic-fuera-para-cerrar vive en un `<button>`
 * que cubre el fondo (en vez de un `onClick` colgado del div contenedor), de
 * modo que la acción es alcanzable con teclado; además cierra con Escape.
 *
 * El contenido debe posicionarse con `relative` para quedar por encima del
 * botón de fondo.
 */
export function ModalBackdrop({
  onClose,
  label,
  children,
}: Readonly<{
  onClose: () => void
  /** Nombre del diálogo, usado en la etiqueta accesible del botón de cierre. */
  label: string
  children: ReactNode
}>) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Cerrar ${label}`}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      {children}
    </div>
  )
}
