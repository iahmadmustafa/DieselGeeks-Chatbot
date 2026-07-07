interface BrandLogoProps {
  logoUrl: string;
  className?: string;
  alt?: string;
}

export function BrandLogo({ logoUrl, className, alt = "Dr Diesel" }: BrandLogoProps) {
  return <img className={className} src={logoUrl} alt={alt} width={32} height={32} loading="lazy" />;
}
