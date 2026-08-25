import Image from "next/image";

type BrandMarkProps = {
  quiet?: boolean;
};

export function BrandMark({ quiet = false }: BrandMarkProps) {
  return (
    <span className="brand-lockup">
      <span className={quiet ? "brand-mark brand-mark--quiet" : "brand-mark"}>
        <Image
          alt=""
          aria-hidden="true"
          height={512}
          priority={!quiet}
          src="/brand/xdenovo-mark.png"
          width={512}
        />
      </span>
      <span className="brand-wordmark" translate="no">
        XDenovo
      </span>
    </span>
  );
}
