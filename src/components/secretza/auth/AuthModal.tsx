"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/useAppStore";
import type { User as UserType } from "@/lib/types";

// ==========================================
// Zod Schemas (Zod v4)
// ==========================================
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    terms: z.literal(true, {
      message: "You must accept the terms",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// ==========================================
// Password Strength Calculator
// ==========================================
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "#EF4444" };
  if (score === 2) return { score: 2, label: "Fair", color: "#F59E0B" };
  if (score === 3) return { score: 3, label: "Good", color: "#3B82F6" };
  if (score === 4) return { score: 4, label: "Strong", color: "#10B981" };
  return { score: 5, label: "Very Strong", color: "#7C3AED" };
}

// ==========================================
// Tab Content Wrapper with Animation
// ==========================================
const tabVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// ==========================================
// Google OAuth Button
// ==========================================
function GoogleButton({
  isLoading,
  onLoadingChange,
}: {
  isLoading: boolean;
  onLoadingChange: (val: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full h-11 rounded-lg border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] hover:bg-[#26263A] hover:border-[rgba(255,255,255,0.15)] transition-all"
      disabled={isLoading}
      onClick={async () => {
        onLoadingChange(true);
        try {
          await signIn("google", { redirect: false });
        } catch {
          toast.error("Google sign-in failed", {
            description: "Please try again.",
          });
        } finally {
          onLoadingChange(false);
        }
      }}
    >
      <svg className="size-4 mr-2" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Continue with Google
    </Button>
  );
}

// ==========================================
// Divider
// ==========================================
function OAuthDivider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[rgba(255,255,255,0.08)]" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="px-3 bg-[#15151D] text-[#A1A1AA]">
          or continue with
        </span>
      </div>
    </div>
  );
}

// ==========================================
// Login Form
// ==========================================
function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const remember = watch("remember");

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Sign in failed", {
          description: result.error === "CredentialsSignin"
            ? "Invalid email or password."
            : result.error,
        });
      } else if (result?.ok) {
        // NextAuth session will be synced via AuthSync provider
        toast.success("Welcome back!", {
          description: "You have been signed in successfully.",
        });
        // The AuthSync provider will handle updating the Zustand store
      }
    } catch {
      toast.error("Sign in failed", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-sm text-[#A1A1AA]">
          Email Address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="login-password" className="text-sm text-[#A1A1AA]">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            className="pl-10 pr-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F5F5F7] transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      {/* Remember + Forgot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(val) => setValue("remember", val === true)}
            className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
          />
          <label
            htmlFor="remember"
            className="text-sm text-[#A1A1AA] cursor-pointer select-none"
          >
            Remember me
          </label>
        </div>
        <button
          type="button"
          onClick={() => setAuthModalTab("forgot-password")}
          className="text-sm text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
        >
          Forgot password?
        </button>
      </div>

      {/* Login Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 rounded-lg font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] shadow-lg shadow-[#7C3AED]/25 hover:shadow-[#7C3AED]/40 transition-all duration-300"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Sign In
            <ArrowRight className="size-4 ml-2" />
          </>
        )}
      </Button>

      <OAuthDivider />

      <GoogleButton isLoading={isLoading} onLoadingChange={setIsLoading} />
    </form>
  );
}

// ==========================================
// Register Form
// ==========================================
function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false as true,
    },
  });

  const password = watch("password");
  const terms = watch("terms");
  const strength = password ? getPasswordStrength(password) : null;

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      // Register via API
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error("Registration failed", {
          description: result.errors?.[0] || "Something went wrong.",
        });
        return;
      }

      // Auto sign in after registration
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        toast.success("Account created!", {
          description: "Please check your email to verify your account.",
        });
      } else {
        toast.success("Account created!", {
          description: "Please sign in with your credentials.",
        });
      }
    } catch {
      toast.error("Registration failed", {
        description: "Network error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="reg-name" className="text-sm text-[#A1A1AA]">
          Full Name
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="reg-name"
            type="text"
            placeholder="Your name"
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("name")}
          />
        </div>
        {errors.name && (
          <p className="text-xs text-red-400">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="reg-email" className="text-sm text-[#A1A1AA]">
          Email Address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="reg-email"
            type="email"
            placeholder="you@example.com"
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="reg-password" className="text-sm text-[#A1A1AA]">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a strong password"
            className="pl-10 pr-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F5F5F7] transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}

        {/* Password Strength Indicator */}
        {password && strength && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className="h-1 flex-1 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor:
                      level <= strength.score
                        ? strength.color
                        : "rgba(255,255,255,0.08)",
                  }}
                />
              ))}
            </div>
            <p
              className="text-xs font-medium transition-colors"
              style={{ color: strength.color }}
            >
              {strength.label}
            </p>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="reg-confirm" className="text-sm text-[#A1A1AA]">
          Confirm Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="reg-confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm your password"
            className="pl-10 pr-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("confirmPassword")}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F5F5F7] transition-colors"
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="terms"
          checked={terms === true}
          onCheckedChange={(val) => setValue("terms", (val === true) as true)}
          className="mt-0.5 border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
        />
        <label
          htmlFor="terms"
          className="text-xs text-[#A1A1AA] cursor-pointer leading-relaxed"
        >
          I agree to the{" "}
          <span className="text-[#8B5CF6] hover:text-[#A78BFA] cursor-pointer">
            Terms of Service
          </span>{" "}
          and{" "}
          <span className="text-[#8B5CF6] hover:text-[#A78BFA] cursor-pointer">
            Privacy Policy
          </span>
        </label>
      </div>
      {errors.terms && (
        <p className="text-xs text-red-400">{errors.terms.message}</p>
      )}

      {/* Register Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 rounded-lg font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] shadow-lg shadow-[#7C3AED]/25 hover:shadow-[#7C3AED]/40 transition-all duration-300"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Creating account...
          </>
        ) : (
          <>
            Create Account
            <ArrowRight className="size-4 ml-2" />
          </>
        )}
      </Button>

      <OAuthDivider />

      <GoogleButton isLoading={isLoading} onLoadingChange={setIsLoading} />
    </form>
  );
}

// ==========================================
// Forgot Password Form
// ==========================================
function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      if (res.ok) {
        setEmailSent(true);
        toast.success("Check your email", {
          description: "If an account exists, a reset link has been sent.",
        });
      } else {
        toast.error("Request failed", {
          description: "Please try again later.",
        });
      }
    } catch {
      toast.error("Request failed", {
        description: "Network error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#7C3AED]/15 flex items-center justify-center mx-auto">
          <Mail className="size-8 text-[#7C3AED]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#F5F5F7]">Check your email</h3>
          <p className="text-sm text-[#A1A1AA] mt-2">
            We&apos;ve sent a password reset link to your email address.
            The link expires in 1 hour.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setEmailSent(false);
            setAuthModalTab("login");
          }}
          className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] hover:bg-[#26263A] rounded-lg"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[#F5F5F7]">Reset Password</h3>
        <p className="text-sm text-[#A1A1AA]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="forgot-email" className="text-sm text-[#A1A1AA]">
          Email Address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 h-11 rounded-lg"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 rounded-lg font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] shadow-lg shadow-[#7C3AED]/25 hover:shadow-[#7C3AED]/40 transition-all duration-300"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <KeyRound className="size-4 mr-2" />
            Send Reset Link
          </>
        )}
      </Button>

      {/* Back to login */}
      <button
        type="button"
        onClick={() => setAuthModalTab("login")}
        className="w-full text-sm text-[#A1A1AA] hover:text-[#F5F5F7] transition-colors flex items-center justify-center gap-1"
      >
        <ArrowLeft className="size-3" />
        Back to Sign In
      </button>
    </form>
  );
}

// ==========================================
// Main AuthModal Component
// ==========================================
export default function AuthModal() {
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen);
  const authModalTab = useAuthStore((s) => s.authModalTab);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  const tabTitles: Record<string, { title: string; desc: string }> = {
    login: {
      title: "Welcome back",
      desc: "Sign in to manage your listings and connect with clients.",
    },
    register: {
      title: "Create account",
      desc: "Join Secretza and start reaching thousands of potential clients.",
    },
    "forgot-password": {
      title: "Reset Password",
      desc: "Recover access to your Secretza account.",
    },
  };

  const isForgotPassword = authModalTab === "forgot-password";

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={setAuthModalOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[440px] bg-[#15151D] border-[rgba(255,255,255,0.08)] p-0 overflow-hidden rounded-2xl"
      >
        {/* Header with Logo */}
        <div className="relative px-8 pt-8 pb-2">
          <button
            onClick={() => setAuthModalOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#F5F5F7] mb-1">
              {tabTitles[authModalTab]?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#A1A1AA]">
              {tabTitles[authModalTab]?.desc}
            </DialogDescription>
          </DialogHeader>
        </div>

        {!isForgotPassword && (
          /* Tab Bar */
          <div className="px-8 pt-2">
            <div className="relative flex bg-[#1E1E2A] rounded-lg p-1">
              <motion.div
                className="absolute top-1 bottom-1 rounded-md bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] shadow-lg shadow-[#7C3AED]/25"
                animate={{
                  left: authModalTab === "login" ? "4px" : "50%",
                  width: "calc(50% - 4px)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
              <button
                onClick={() => setAuthModalTab("login")}
                className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  authModalTab === "login" ? "text-white" : "text-[#A1A1AA] hover:text-[#F5F5F7]"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthModalTab("register")}
                className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  authModalTab === "register"
                    ? "text-white"
                    : "text-[#A1A1AA] hover:text-[#F5F5F7]"
                }`}
              >
                Register
              </button>
            </div>
          </div>
        )}

        {/* Tab Content with Animation */}
        <div className="px-8 py-6">
          <AnimatePresence mode="wait">
            {authModalTab === "login" ? (
              <motion.div
                key="login"
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <LoginForm />
              </motion.div>
            ) : authModalTab === "register" ? (
              <motion.div
                key="register"
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <RegisterForm />
              </motion.div>
            ) : (
              <motion.div
                key="forgot-password"
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <ForgotPasswordForm />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6">
          <p className="text-center text-xs text-[#52525B]">
            By continuing, you agree to Secretza&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
