"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Image
            src="/icons/logo.png"
            alt="JNews"
            width={72}
            height={72}
            priority
            className="rounded-xl"
          />
          <h1 className="text-2xl font-bold text-center">JNews</h1>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
          {error && (
            <p className="text-sm text-danger text-center">{error}</p>
          )}
          <Button type="submit" loading={loading} className="w-full mt-2">
            {isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="w-full text-center text-sm text-text-secondary hover:text-primary mt-4 transition-colors"
        >
          {isSignUp ? "Ja tem conta? Entrar" : "Criar conta"}
        </button>
      </Card>
    </div>
  );
}
