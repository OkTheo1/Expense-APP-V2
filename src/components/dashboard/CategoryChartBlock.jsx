import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

const COLORS = ['#14b8a6', '#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#6366f1'];

export default function CategoryChartBlock({ data, currency }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
          <PieChartIcon className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <p className="text-sm text-slate-400">Category Breakdown</p>
          <p className="text-lg font-medium text-white mt-0.5">Spending by Category</p>
        </div>
      </div>
      {data && data.length > 0 ? (
        <>
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${currency === 'GBP' ? '£' : '$'}${value.toFixed(2)}`, 'Spent']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.slice(0, 6).map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-slate-400 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-48 flex items-center justify-center text-slate-500">
          No spending data yet
        </div>
      )}
    </div>
  );
}