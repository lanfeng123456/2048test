"use client";

import { useState } from "react";
import styles from "./Subscribe.module.css";

type Plan = "monthly" | "yearly";

export default function Subscribe() {
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: Plan) {
    setError(null);
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "无法发起支付，请稍后重试");
        setLoading(null);
        return;
      }
      window.location.href = data.checkoutUrl as string;
    } catch {
      setError("网络错误，请重试");
      setLoading(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.plans}>
        <button
          type="button"
          className={styles.plan}
          disabled={loading !== null}
          onClick={() => subscribe("monthly")}
        >
          <span className={styles.planName}>包月订阅</span>
          <span className={styles.planDesc}>无限畅玩 · 按月续费</span>
          <span className={styles.planCta}>
            {loading === "monthly" ? "跳转中…" : "选择包月"}
          </span>
        </button>

        <button
          type="button"
          className={`${styles.plan} ${styles.planFeatured}`}
          disabled={loading !== null}
          onClick={() => subscribe("yearly")}
        >
          <span className={styles.badge}>更划算</span>
          <span className={styles.planName}>包年订阅</span>
          <span className={styles.planDesc}>无限畅玩 · 按年续费</span>
          <span className={styles.planCta}>
            {loading === "yearly" ? "跳转中…" : "选择包年"}
          </span>
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
