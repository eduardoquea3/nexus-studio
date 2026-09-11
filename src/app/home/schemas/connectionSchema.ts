import { z } from "zod";

export const newConnectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  db_type: z.enum(["postgres", "mysql", "sqlite"]),
  authentication_method: z.enum(["username_password", "connection_string"]),
  connection_mode: z.enum(["host_and_port", "connection_string"]),
  host: z.string().min(1).optional(),
  port: z.coerce.number().int().positive().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl_enabled: z.boolean().default(false),
  ssh_enabled: z.boolean().default(false),
  read_only: z.boolean().default(false),
  save_passwords: z.boolean().default(true),
  color: z.string().optional(),
});

export type NewConnectionValues = z.infer<typeof newConnectionSchema>;
