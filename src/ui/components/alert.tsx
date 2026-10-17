import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/ui/lib/utils";

const alertVariants = cva("flex gap-3 rounded-xl border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "border-border bg-muted text-foreground",
      warning: "border-transparent bg-warning text-warning-foreground",
      destructive: "border-transparent bg-accent text-accent-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  // role=alert só para erro; os demais usam status para não interromper o leitor de tela.
  return <div role={variant === "destructive" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
