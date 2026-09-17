import Link from "next/link";
import { milliToQuantity, quantityToMilli } from "@/domain/contracts";
import type { CapitalMovementType, ExpenseCategory } from "@/domain/finance";
import type { AppErrorCode } from "@/server/result";

export const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
export const paymentLabels = { paid: "Lunas", partial: "Sebagian", unpaid: "Belum dibayar", due: "Jatuh tempo", overdue: "Terlambat" } as const;
export const deliveryLabels = { unprocessed: "Belum diproses", preparing: "Disiapkan", ready: "Siap diantar", in_transit: "Dalam perjalanan", partially_delivered: "Diantar sebagian", received: "Diterima", failed: "Gagal", cancelled: "Dibatalkan" } as const;
export const movementLabels = { out: "Peti keluar", return: "Peti kembali", adjustment: "Penyesuaian" } as const;
export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  egg_purchase: "Pembelian telur",
  delivery: "Transportasi / pengiriman",
  fuel_toll_parking: "BBM, tol, dan parkir",
  loading: "Bongkar muat",
  wages: "Upah",
  packaging_crates: "Kemasan / peti",
  maintenance: "Perawatan",
  rent_utilities_operations: "Sewa, listrik, dan operasional",
  other: "Lainnya",
};
export const capitalMovementLabels: Record<CapitalMovementType, string> = {
  capital_in: "Modal masuk",
  owner_draw: "Prive / pengambilan pribadi",
};
export const paymentMethodLabels = {
  cash: "Tunai",
  transfer: "Transfer",
  other: "Lainnya",
} as const;

/* Kuantitas ditampilkan dengan koma desimal Indonesia. */
const formatQuantity = (milli: number) => milliToQuantity(milli).replace(".", ",");
export const formatCrate = (milli: number) => `${formatQuantity(milli)} peti`;
export const formatItemQuantity = (value: string | null): string => value === null ? "-" : formatQuantity(quantityToMilli(value));
export const formatFinanceDate = (value: string) => new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

export function PaymentBadge({ status }: { status: keyof typeof paymentLabels }) { return <span className={`status status-${status}`}>{paymentLabels[status]}</span>; }
export function DeliveryBadge({ status }: { status: keyof typeof deliveryLabels }) { return <span className={`status delivery-${status}`}>{deliveryLabels[status]}</span>; }
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) { return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>; }
export function EmptyState({ title, detail, href, label }: { title: string; detail: string; href?: string; label?: string }) { return <section className="empty-state"><h2>{title}</h2><p>{detail}</p>{href && label && <Link className="button" href={href}>{label}</Link>}</section>; }
export function ErrorState({ code, message, retryHref }: { code: AppErrorCode; message: string; retryHref?: string }) { const unauthorized = code === "unauthorized"; return <section className="error-state" role="alert"><h2>{unauthorized ? "Sesi Anda berakhir" : "Terjadi kendala"}</h2><p>{message}</p><Link className="button" href={unauthorized ? "/login?next=/dashboard" : retryHref ?? "/dashboard"}>{unauthorized ? "Masuk kembali" : "Coba lagi"}</Link></section>; }
