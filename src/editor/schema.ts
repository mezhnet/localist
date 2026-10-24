// Gemeinsames Editor-Schema für BlockNote. Konverter und Oberfläche nutzen dieselben Typen.
import { BlockNoteSchema } from "@blocknote/core";

export const schema = BlockNoteSchema.create();

export type VaultBlock = typeof schema.Block;
export type VaultPartialBlock = typeof schema.PartialBlock;
