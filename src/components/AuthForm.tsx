"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; submit: string; altText: string; altHref: string; altLink: string }> = {
  login: {
    title: "登录",
    submit: "登录",
    altText: "还没有账号？",
    altHref: "/register",
    altLink: "注册",
  },
  register: {
    title: "注册",
    submit: "创建账号",
    altText: "已有账号？",
    altHref: "/login",
    altLink: "登录",
  },
};

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === "register"
        ? await signUp.email({ name: name.trim() || email.split("@")[0], email, password })
        : await signIn.email({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "操作失败，请重试");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const result = await signIn.social({ provider: "google", callbackURL: "/" });
    // On success the browser is redirected to Google; only errors return here.
    if (result?.error) {
      setError(result.error.message ?? "Google 登录失败");
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.heading}>2048</h1>
        <p className={styles.subtitle}>{copy.title}以保存你的最高分</p>

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogle}
          disabled={loading}
        >
          使用 Google {copy.title}
        </button>

        <div className={styles.divider}>
          <span>或使用邮箱</span>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "register" && (
            <label className={styles.label}>
              昵称（可选）
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={styles.input}
              />
            </label>
          )}

          <label className={styles.label}>
            邮箱
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={styles.input}
            />
          </label>

          <label className={styles.label}>
            密码
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className={styles.input}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "处理中…" : copy.submit}
          </button>
        </form>

        <p className={styles.alt}>
          {copy.altText} <Link href={copy.altHref}>{copy.altLink}</Link>
        </p>
      </div>
    </div>
  );
}
