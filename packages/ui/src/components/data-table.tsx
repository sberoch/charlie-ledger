"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  hidePagination?: boolean;
  loading?: boolean;
  pagination?: {
    pageCount: number;
    pageIndex: number;
    pageSize: number;
    totalItems: number;
    onPaginationChange: (updaterOrValue: Updater<PaginationState>) => void;
  };
  sorting?: {
    order?: string;
    onSortingChange: (updaterOrValue: Updater<SortingState>) => void;
  };
  search?: {
    value: string;
    onSearchChange: (value: string) => void;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  hidePagination,
  loading = false,
  pagination,
  sorting,
  search,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: sorting?.onSortingChange,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: !!pagination,
    state: {
      sorting: sorting?.order
        ? (() => {
            const [id = "", dir] = sorting.order.split(":");
            return [{ id, desc: dir === "desc" }];
          })()
        : [],
      columnFilters,
      ...(pagination && {
        pagination: {
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
        },
      }),
    },
    pageCount: pagination?.pageCount,
    onColumnFiltersChange: setColumnFilters,
    getPaginationRowModel: !pagination ? getPaginationRowModel() : undefined,
    onPaginationChange: pagination?.onPaginationChange,
  });

  return (
    <div>
      {search && (
        <div className="flex items-center py-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search.value}
              onChange={(event) => search.onSearchChange(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className={(header.column.columnDef.meta as any)?.className}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="animate-pulse">
                  {columns.map((col, colIndex) => (
                    <TableCell key={`skeleton-cell-${colIndex}`} className={(col.meta as any)?.className}>
                      <Skeleton className="h-4 w-full rounded-md" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel()?.rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={(cell.column.columnDef.meta as any)?.className}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center">
                  <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
                    <SearchX className="size-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground font-medium text-base">
                      No results.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!hidePagination && (
        <div className="flex items-center justify-between mt-6 px-1">
          <div className="flex items-center text-sm text-muted-foreground">
            <span>Showing</span>
            <span className="mx-1 px-2 py-0.5 bg-muted rounded-md font-semibold text-foreground">
              {data.length}
            </span>
            <span>of</span>
            <span className="mx-1 px-2 py-0.5 bg-muted rounded-md font-semibold text-foreground">
              {pagination?.totalItems}
            </span>
            <span>records</span>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <span>
                Page {(pagination?.pageIndex || 0) + 1} of{" "}
                {pagination?.pageCount || 1}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
