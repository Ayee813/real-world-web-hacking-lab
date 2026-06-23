import { useEffect, useState } from 'react';
import { Users as UsersIcon, Mail, Calendar } from 'lucide-react';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<UserRow[]>('/users')
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm mt-1">All registered accounts on this platform</p>
        </div>

        {loading && (
          <div className="text-center py-20 text-gray-400 text-sm">Loading members...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="text-center py-20">
            <UsersIcon size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No members found.</p>
          </div>
        )}

        {users.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Mail size={12} /> Email</span>
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Calendar size={12} /> Joined</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role !== 'admin').map((user, i) => (
                  <tr
                    key={user.id}
                    className={`${i < users.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{user.email}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="px-5 py-3.5" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
