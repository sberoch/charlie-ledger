"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"
import {
  AppSettingsSchema,
  UserSchema,
  formatInvoiceNumber,
  type AddUserInput,
  type AppSettingsDto,
  type UpdateAppSettingsInput,
  type UserDto,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import { PageHeader } from "@/components/shell/page-header"
import { api } from "@/lib/api"
import { TagsPanel } from "./tags-panel"

function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings", { schema: AppSettingsSchema }),
  })
}

function useUsers() {
  return useQuery({
    queryKey: ["settings", "users"],
    queryFn: () => api("/settings/users", { schema: z.array(UserSchema) }),
  })
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()
  const { data: users } = useUsers()

  const [lookahead, setLookahead] = useState<string | null>(null)
  const [nextNumber, setNextNumber] = useState<string | null>(null)
  const [newUser, setNewUser] = useState<AddUserInput>({
    name: "",
    email: "",
    password: "",
  })

  const updateSettings = useMutation({
    mutationFn: (input: UpdateAppSettingsInput) =>
      api<AppSettingsDto>("/settings", {
        method: "PATCH",
        body: input,
        schema: AppSettingsSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      toast.success("Settings saved")
      setLookahead(null)
      setNextNumber(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const addUser = useMutation({
    mutationFn: (input: AddUserInput) =>
      api<UserDto>("/settings/users", {
        method: "POST",
        body: input,
        schema: UserSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] })
      toast.success("User added")
      setNewUser({ name: "", email: "", password: "" })
    },
    onError: (e) => toast.error(e.message),
  })

  if (!settings) return <Skeleton className="h-64" />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />

      <div className="flex flex-col gap-5">
        <Panel title="Weekly Digest">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Mondays 7:00am EST. Licenses expiring, holds lifting, overdue
            invoices within the look-ahead window.
          </p>
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                Look-ahead · days
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={lookahead ?? String(settings.digestLookaheadDays)}
                onChange={(e) => setLookahead(e.target.value)}
                className="max-w-28"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-10"
              disabled={lookahead === null || updateSettings.isPending}
              onClick={() =>
                updateSettings.mutate({
                  digestLookaheadDays: Number(lookahead),
                })
              }
            >
              Save
            </Button>
          </div>
        </Panel>

        <Panel title="Invoice Numbering">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Next number to be issued:{" "}
            <strong className="text-foreground">
              {formatInvoiceNumber(settings.nextInvoiceNumber)}
            </strong>
            . Move it forward to continue an existing sequence (e.g. where
            QuickBooks left off). It can never rewind below an issued number.
          </p>
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                Next invoice number
              </label>
              <Input
                type="number"
                min={1}
                value={nextNumber ?? String(settings.nextInvoiceNumber)}
                onChange={(e) => setNextNumber(e.target.value)}
                className="max-w-28"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10"
              disabled={nextNumber === null || updateSettings.isPending}
              onClick={() =>
                updateSettings.mutate({ nextInvoiceNumber: Number(nextNumber) })
              }
            >
              Save
            </Button>
          </div>
        </Panel>

        <Panel title={`Users · ${users?.length ?? "…"}`}>
          <div className="mb-4 flex flex-col">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between border-b border-border-soft py-2.5 text-sm last:border-0"
              >
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <div className="mb-2.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Add user
            </div>
            <div className="flex flex-col gap-2.5 md:flex-row">
              <Input
                placeholder="Name"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
              />
              <Input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
              <Input
                type="password"
                placeholder="Password (min 8)"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
              <Button
                type="button"
                disabled={
                  addUser.isPending ||
                  !newUser.name ||
                  !newUser.email ||
                  newUser.password.length < 8
                }
                onClick={() => addUser.mutate(newUser)}
              >
                Add
              </Button>
            </div>
          </div>
        </Panel>

        <TagsPanel />
      </div>
    </div>
  )
}
