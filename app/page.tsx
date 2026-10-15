import { HomeView } from "@/components/store/home-view";
import { getCatalog, getEdits } from "@/lib/catalog/source";

export default function Home() {
  return <HomeView catalog={getCatalog()} edits={getEdits()} />;
}
