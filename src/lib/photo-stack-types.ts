export interface PhotoStackPhoto {
  id: string;
  src: string;
  previewSrc: string;
  stackSrc: string;
  alt: string;
  width: number;
  height: number;
  work?: PhotoStackWork;
}

interface PhotoStackWork {
  title: string;
  summary?: string;
  href?: string;
  images?: readonly {
    src: string;
    alt: string;
    width: number;
    height: number;
  }[];
}
