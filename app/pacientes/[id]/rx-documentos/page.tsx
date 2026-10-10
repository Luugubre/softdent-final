import { getSupabase } from "@/lib/supabase"
import { formatearFechaHora } from "@/lib/formato"
import { SubirArchivo } from "@/components/ficha/SubirArchivo"
import {
  BUCKET_ARCHIVOS,
  CATEGORIA_ARCHIVO_ETIQUETAS,
  formatearTamano,
  type ArchivoPaciente,
} from "@/types/archivo"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"

export default async function RxDocumentosPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("archivos_paciente")
    .select("*")
    .eq("paciente_id", id)
    .order("fecha_subida", { ascending: false })

  const archivos = (data ?? []) as ArchivoPaciente[]

  // El bucket es privado: se generan enlaces temporales (1 hora)
  const urls = new Map<string, string>()
  if (archivos.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from(BUCKET_ARCHIVOS)
      .createSignedUrls(archivos.map((a) => a.ruta_storage), 3600)
    firmadas?.forEach((f) => f.path && f.signedUrl && urls.set(f.path, f.signedUrl))
  }

  return (
    <div className="space-y-5">
      {puede(usuario.rol, "archivos.subir") && <SubirArchivo pacienteId={id} />}

      {error && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          No se pudieron cargar los archivos: {error.message}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-gray-900">
          Archivos del paciente <span className="text-gray-400">({archivos.length})</span>
        </h2>

        {archivos.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">Aún no se han subido archivos.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {archivos.map((a) => {
              const url = urls.get(a.ruta_storage)
              const esImagen = a.tipo_mime.startsWith("image/")
              return (
                <a
                  key={a.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:border-blue-400 transition-colors"
                >
                  <div className="aspect-square bg-gray-900 flex items-center justify-center overflow-hidden">
                    {esImagen && url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={a.titulo} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <span className="text-4xl">📄</span>
                    )}
                  </div>
                  <div className="p-3 space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                      {CATEGORIA_ARCHIVO_ETIQUETAS[a.categoria]}
                    </p>
                    <p className="text-sm font-extrabold text-gray-900 truncate">{a.titulo}</p>
                    {a.descripcion && <p className="text-xs font-medium text-gray-600 line-clamp-2">{a.descripcion}</p>}
                    <p className="text-[11px] font-medium text-gray-400">
                      {formatearFechaHora(a.fecha_subida)} · {formatearTamano(a.tamano_bytes)}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
