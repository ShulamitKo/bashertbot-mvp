import { LogOut, Settings, User } from 'lucide-react'
import { signOut } from '@/lib/auth'

interface HeaderProps {
  user?: {
    name: string
    email: string
  }
  onSignOut?: () => void
}

export const Header = ({ user, onSignOut }: HeaderProps) => {
  const handleSignOut = async () => {
    const result = await signOut()
    if (result.success && onSignOut) {
      onSignOut()
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* לוגו ושם */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">ב</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">באשערטבוט</h1>
            </div>
          </div>

          {/* פרטי משתמש ופעולות */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-gray-500" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-gray-500">{user.email}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="הגדרות"
                >
                  <Settings className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleSignOut}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="יציאה"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 