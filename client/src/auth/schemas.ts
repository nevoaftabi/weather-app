import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least 1 lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least 1 number.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
