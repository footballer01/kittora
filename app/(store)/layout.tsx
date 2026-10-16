import { StoreChrome } from "@/components/store/chrome";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return <StoreChrome>{children}</StoreChrome>;
}
