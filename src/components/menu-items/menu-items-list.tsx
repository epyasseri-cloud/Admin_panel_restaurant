import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { MenuItem } from '@/types';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCurrency } from '@/utils/helpers';

interface MenuItemsListProps {
  items: MenuItem[];
  isLoading: boolean;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

export function MenuItemsList({
  items,
  isLoading,
  onEdit,
  onDelete,
  onToggleAvailability,
}: MenuItemsListProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const columns = useMemo<ColumnDef<MenuItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nombre',
        cell: (info) => info.getValue(),
      },
      {
        accessorKey: 'category',
        header: 'Categoría',
        cell: (info) => info.getValue(),
      },
      {
        accessorKey: 'price',
        header: 'Precio',
        cell: (info) => formatCurrency(info.getValue() as number),
      },
      {
        accessorKey: 'available',
        header: 'Disponibilidad',
        cell: (info) => (
          <span className={info.getValue() ? 'text-green-600' : 'text-red-600'}>
            {info.getValue() ? 'Disponible' : 'No disponible'}
          </span>
        ),
      },
      {
        accessorKey: 'estimated_prep_time',
        header: 'Tiempo de preparación',
        cell: (info) => {
          const time = info.getValue() as number | undefined;
          return time ? `${time} min` : 'N/A';
        },
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(item)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onToggleAvailability(item)}
              >
                {item.available ? 'Excluir' : 'Restaurar'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(item)}
              >
                Eliminar
              </Button>
            </div>
          );
        },
      },
    ],
    [onEdit, onDelete, onToggleAvailability]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesGlobal =
        !globalFilter ||
        item.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
        item.description?.toLowerCase().includes(globalFilter.toLowerCase());

      const matchesCategory = !categoryFilter || item.category === categoryFilter;

      return matchesGlobal && matchesCategory;
    });
  }, [items, globalFilter, categoryFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category)));
  }, [items]);

  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Buscar</label>
            <Input
              placeholder="Buscar por nombre o descripción..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full mt-1 border rounded px-3 py-2"
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <th key={header.id} className="text-left py-2 px-4 font-medium">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-2 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {table.getRowModel().rows.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No hay ítems que mostrar
            </p>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Página {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

