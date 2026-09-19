'use client'

import React, { useState, useEffect, useRef } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SuperCatalogProduct } from '../../types'

interface SuperProductImagesModalProps {
  isOpen: boolean
  product: SuperCatalogProduct | null
  onClose: () => void
  onSaveImages: (productId: string, imageUrl?: string, images?: string[]) => Promise<any>
}

export function SuperProductImagesModal({
  isOpen,
  product,
  onClose,
  onSaveImages,
}: SuperProductImagesModalProps) {
  const [mainImageUrl, setMainImageUrl] = useState('')
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [isDragOverMain, setIsDragOverMain] = useState(false)
  const [isDragOverGallery, setIsDragOverGallery] = useState(false)

  const mainFileInputRef = useRef<HTMLInputElement>(null)
  const galleryFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (product) {
      setMainImageUrl(product.imageUrl || '')
      setGalleryImages(product.images || [])
    }
  }, [product])

  if (!isOpen || !product) return null

  // File to base64 dataUrl helper
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Error al procesar la imagen'))
      reader.readAsDataURL(file)
    })
  }

  // Handle Main Image Upload
  const handleMainFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP, SVG).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB.')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setMainImageUrl(dataUrl)
    } catch {
      alert('Error al leer el archivo de imagen.')
    }
  }

  // Handle Gallery Images (single or multiple)
  const handleGalleryFilesSelected = async (files: FileList | File[]) => {
    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024) {
        validFiles.push(f)
      }
    }

    if (validFiles.length === 0) {
      alert('Selecciona archivos de imagen válidos menores a 5MB.')
      return
    }

    try {
      const newUrls = await Promise.all(validFiles.map(readFileAsDataUrl))
      setGalleryImages((prev) => [...prev, ...newUrls])
    } catch {
      alert('Error al procesar algunas imágenes de la galería.')
    }
  }

  const handleRemoveImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSetAsMain = (url: string) => {
    setMainImageUrl(url)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setGalleryImages((prev) => {
      const copy = [...prev]
      const temp = copy[index - 1]
      copy[index - 1] = copy[index]
      copy[index] = temp
      return copy
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSaveImages(product.id, mainImageUrl, galleryImages)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-[560px] p-6 shadow-2xl flex flex-col max-h-[90vh] border border-slate-100 animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
              <AppIcon name="layers" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Galería de Imágenes Web
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[320px]">
                {product.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 flex flex-col gap-5 py-4 pr-1">
          {/* Imagen Principal (Portada de Tienda) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Imagen Principal (Portada de Tienda)
              </label>
              {mainImageUrl && (
                <button
                  type="button"
                  onClick={() => setMainImageUrl('')}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Quitar portada
                </button>
              )}
            </div>

            <input
              ref={mainFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleMainFileSelected(e.target.files[0])
                }
              }}
            />

            {mainImageUrl ? (
              <div className="relative flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/80 group">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 shadow-xs">
                  <img
                    src={mainImageUrl}
                    alt="Portada"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60 mb-1">
                    ★ Portada actual
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    Visible como foto principal en catálogo y ecommerce.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => mainFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <AppIcon name="upload" size={13} />
                  <span>Cambiar</span>
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOverMain(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setIsDragOverMain(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragOverMain(false)
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleMainFileSelected(e.dataTransfer.files[0])
                  }
                }}
                onClick={() => mainFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  isDragOverMain
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                    <AppIcon name="upload" size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Haz clic para subir imagen
                    </span>{' '}
                    <span className="text-xs text-slate-500">o arrastra aquí</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    PNG, JPG, WEBP o SVG (máx. 5MB)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Subir Imágenes Adicionales para Galería */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-800">
              Agregar Fotos a la Galería
            </label>

            <input
              ref={galleryFileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleGalleryFilesSelected(e.target.files)
                }
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOverGallery(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDragOverGallery(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOverGallery(false)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleGalleryFilesSelected(e.dataTransfer.files)
                }
              }}
              onClick={() => galleryFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragOverGallery
                  ? 'border-purple-500 bg-purple-50/60'
                  : 'border-slate-300 hover:border-purple-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                  <AppIcon name="layers" size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Subir fotos adicionales
                  </span>{' '}
                  <span className="text-xs text-slate-500">(puedes seleccionar varias)</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Formatos recomendados: PNG, JPG, WEBP (máx. 5MB c/u)
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Imágenes Actuales en la Galería */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Fotos de la Galería ({galleryImages.length})
              </span>
            </div>

            {galleryImages.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs font-medium">
                No hay fotos secundarias en la galería todavía.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {galleryImages.map((img, idx) => {
                  const isMain = img === mainImageUrl

                  return (
                    <div
                      key={idx}
                      className={`relative group rounded-xl border p-2 flex flex-col gap-1.5 transition-all duration-150 ${
                        isMain
                          ? 'border-blue-300 bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        <img
                          src={img}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {isMain && (
                          <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            Portada
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 gap-1">
                        {!isMain && (
                          <button
                            type="button"
                            onClick={() => handleSetAsMain(img)}
                            className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md transition-colors"
                          >
                            Hacer Portada
                          </button>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveUp(idx)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Subir orden"
                            >
                              <AppIcon
                                name="chevronDown"
                                size={12}
                                className="rotate-180"
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Eliminar imagen"
                          >
                            <AppIcon name="close" size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Galería'}
          </button>
        </div>
      </div>
    </div>
  )
}
