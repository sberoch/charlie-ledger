import { Module } from "@nestjs/common";
import { db } from "./db";

export const DrizzleProvider = Symbol("drizzle-connection");

@Module({
  providers: [{ provide: DrizzleProvider, useValue: db }],
  exports: [DrizzleProvider],
})
export class DrizzleModule {}
