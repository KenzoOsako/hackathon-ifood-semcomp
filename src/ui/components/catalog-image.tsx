"use client";
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

// A chave no chamador reinicia a falha quando um refinamento troca o recurso.
export function CatalogImage({ src, alt, sizes = "64px" }: Readonly<{ src: string; alt: string; sizes?: string }>) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <span role="img" aria-label={`${alt || "Imagem"} indisponível`} className="flex size-full items-center justify-center bg-secondary"><ImageOff aria-hidden="true" className="size-5 text-muted-foreground" /></span>
    : <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" onError={() => setFailed(true)} />;
}
