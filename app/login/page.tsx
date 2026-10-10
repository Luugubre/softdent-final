import { FormLogin } from "@/components/FormLogin"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-4xl">🦷</p>
          <h1 className="text-2xl font-extrabold text-gray-900">SoftDent</h1>
          <p className="text-sm font-medium text-gray-500">Ingresa con tu cuenta de la clínica</p>
        </div>
        <FormLogin next={next ?? ""} />
      </div>
    </main>
  )
}
