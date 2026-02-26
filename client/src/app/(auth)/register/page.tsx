'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({
    phone: '+254',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(form.phone, form.password, form.first_name, form.last_name, form.email);
      // Navigate to OTP verification
      router.push(`/verify-otp?phone=${encodeURIComponent(form.phone)}&purpose=registration`);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-1">
            <span className="text-brand-500">Stake</span>
            <span className="text-gold-400">Option</span>
          </h1>
          <p className="text-surface-200/60">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="first_name"
              label="First Name"
              placeholder="John"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
            />
            <Input
              id="last_name"
              label="Last Name"
              placeholder="Mwangi"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
            />
          </div>

          <Input
            id="phone"
            label="Phone Number"
            type="tel"
            placeholder="+254712345678"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            required
          />

          <Input
            id="email"
            label="Email (Optional)"
            type="email"
            placeholder="john@example.com"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            required
            minLength={8}
          />

          <Button type="submit" className="w-full" size="lg" isLoading={loading}>
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-surface-200/60 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Log In
          </Link>
        </p>

        <p className="text-center text-xs text-surface-200/40 mt-4">
          By registering, you agree to our Terms of Service and acknowledge the risks of binary options trading.
        </p>
      </div>
    </div>
  );
}
