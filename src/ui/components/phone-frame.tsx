import * as React from "react";
import { cn } from "@/ui/lib/utils";

// A demo roda em Chrome desktop, mas o produto é mobile-first: no desktop mostramos um "celular"
// centralizado; abaixo de 640px a moldura some e o app ocupa a tela inteira.
function PhoneFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className="flex min-h-dvh justify-center bg-muted sm:items-center sm:p-6">
      <div
        className={cn(
          "phone-frame relative flex h-dvh w-full flex-col overflow-hidden bg-background sm:h-[844px] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[390px] sm:rounded-[2.5rem] sm:border sm:border-border sm:shadow-2xl",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export { PhoneFrame };
