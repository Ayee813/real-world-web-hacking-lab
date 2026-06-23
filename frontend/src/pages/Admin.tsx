import { ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Admin() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <ShieldCheck size={32} className="text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Congratulation, hacking complete — try other vulnerability
        </h1>
        <p className="text-gray-500 text-sm">
          You have successfully escalated your privileges to admin. Explore the other vulnerabilities in the lab.
        </p>
      </main>
    </div>
  );
}
