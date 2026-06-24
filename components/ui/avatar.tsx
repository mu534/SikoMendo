import { initials, cn } from "@/lib/utils";

export function Avatar({
  name,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" }[size];

  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary URLs, dimensions vary by usage
    return <img src={imageUrl} alt={name} className={cn("rounded-full object-cover", dimensions, className)} />;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-100 font-display font-semibold text-brand-800",
        dimensions,
        className
      )}
    >
      {initials(name) || "?"}
    </div>
  );
}
