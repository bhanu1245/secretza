import StructuredData from "./StructuredData";

type JsonLdProps = {
  data: unknown;
};

export default function JsonLd({ data }: JsonLdProps) {
  return <StructuredData data={data} />;
}