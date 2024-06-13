import { Langtail } from "langtail";

export const lt = new Langtail({
  apiKey: process.env.LANGTAIL_API_KEY ?? "",
});
