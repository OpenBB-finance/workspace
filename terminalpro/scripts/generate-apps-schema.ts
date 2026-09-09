import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod"
import { templateSpecificationSchema } from "../src/lib/types/app";

const schema =  z.toJSONSchema(templateSpecificationSchema, { reused: "inline", target: "draft-7" })

const out = resolve(process.cwd(), "apps-schema.json");
writeFileSync(out, JSON.stringify(schema, null, 2));
console.log(`Wrote ${out}`);
