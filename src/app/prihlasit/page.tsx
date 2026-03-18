import LoginForm from '@/components/auth/LoginForm'

export const metadata = { title: 'Přihlášení — Gamebooker' }

export default function PrihlasitPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-2xl shadow-sm border">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Gamebooker</h1>
          <p className="text-slate-500 text-sm">Přihlaste se jako tvůrce</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
