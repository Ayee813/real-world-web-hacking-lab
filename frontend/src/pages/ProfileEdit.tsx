import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Save, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';
import { getUser, saveSession, getToken, clearSession } from '../lib/auth';
import type { User as UserType } from '../lib/auth';

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

export default function ProfileEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = getUser();
  const isOwnProfile = currentUser?.id === id;

  const [profile, setProfile] = useState<UserRow | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<UserRow>(`/user/${id}`)
      .then(u => {
        setProfile(u);
        setUsername(u.username);
        setEmail(u.email);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const body: Record<string, string> = { username, email };
    if (password) body.password = password;

    try {
      const updated = await api.put<UserRow>(`/user/${id}`, body);
      setProfile(updated);
      setPassword('');
      setSuccess('Profile updated.');

      // If the returned role changed (e.g. via Burp tampering), refresh the JWT
      // so the navbar and route guards pick it up on next login.
      if (isOwnProfile && updated.role !== currentUser?.role) {
        // Force re-login to get fresh token with new role
        clearSession();
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this account? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/user/${id}`);
      if (isOwnProfile) {
        clearSession();
        navigate('/login');
      } else {
        navigate('/users');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-8 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {loading && (
          <div className="text-center py-20 text-gray-400 text-sm">Loading profile...</div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {profile && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-lg font-bold">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{profile.username}</h1>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                    profile.role === 'admin'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {profile.role}
                  </span>
                </div>
              </div>

              {!isOwnProfile && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  You are editing another user's profile.
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><User size={14} /> Username</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Mail size={14} /> Email address</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  {!showPassword ? (
                    <button
                      type="button"
                      onClick={() => setShowPassword(true)}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-600 border border-gray-300 hover:border-green-500 px-3.5 py-2.5 rounded-lg transition-colors"
                    >
                      <Lock size={14} /> Reset password
                    </button>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <span className="flex items-center gap-1.5"><Lock size={14} /> New password</span>
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoFocus
                        placeholder="Enter new password"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                      />
                    </>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3.5 py-2.5">
                    {success}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete account
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>

            <p className="mt-4 text-xs text-gray-400 text-center">
              Joined {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
