"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"
import {
  UserSchema,
  type AddUserInput,
  type UserDto,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Panel } from "@/components/panel"
import { api } from "@/lib/api"

function useUsers() {
  return useQuery({
    queryKey: ["settings", "users"],
    queryFn: () => api("/settings/users", { schema: z.array(UserSchema) }),
  })
}

export function UsersPanel() {
  const queryClient = useQueryClient()
  const { data: users } = useUsers()
  const [newUser, setNewUser] = useState<AddUserInput>({
    name: "",
    email: "",
    password: "",
  })

  const addUser = useMutation({
    mutationFn: (input: AddUserInput) =>
      api<UserDto>("/settings/users", {
        method: "POST",
        body: input,
        schema: UserSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "users"] })
      toast.success("User added")
      setNewUser({ name: "", email: "", password: "" })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Panel title={`Users · ${users?.length ?? "…"}`}>
      {users ? (
        <div className="mb-4 flex flex-col">
          {users.map((user) => (
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
      ) : (
        <Skeleton className="mb-4 h-24" />
      )}
      <div className="border-t pt-4">
        <div className="mb-2.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Add user
        </div>
        <div className="flex flex-col gap-2.5 md:flex-row">
          <Input
            placeholder="Name"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
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
  )
}
