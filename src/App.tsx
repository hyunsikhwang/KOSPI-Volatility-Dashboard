import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Cell,
  ReferenceLine,
  ComposedChart,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Activity, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface RawData {
  date: string;
  close: number;
}

interface YearlyResult {
  year: number;
  trading_days: number;
  first_close: number;
  last_close: number;
  avg_abs_daily_return_decimal: number;
  avg_abs_daily_return_pct: number;
  index_change_decimal: number;
  index_change_pct: number;
  direction: '상승' | '하락' | '보합';
}

export default function App() {
  const [data, setData] = useState<RawData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Attempting to fetch data from /api/kospi...");
      
      const response = await axios.get('/api/kospi', { timeout: 30000 });
      console.log("Received response from /api/kospi:", response.status);
      
      const mappedData = response.data.map((item: any) => ({
        date: item.date,
        close: item.close
      })).filter((item: any) => item.close !== null && item.close !== undefined);
      
      if (mappedData.length === 0) {
        throw new Error('데이터가 비어 있습니다.');
      }
      
      setData(mappedData);
    } catch (err: any) {
      console.error("Fetch error details:", err);
      
      let errorMsg = '데이터를 불러오는 데 실패했습니다.';
      
      if (err.code === 'ECONNABORTED') {
        errorMsg += ' (요청 시간 초과)';
      } else if (err.message === 'Network Error') {
        errorMsg += ' (네트워크 연결 오류 - 서버가 실행 중인지 확인해주세요)';
      } else if (err.response) {
        const detail = err.response.data?.details || err.response.statusText;
        errorMsg += ` (${err.response.status}: ${detail})`;
      } else {
        errorMsg += ` (${err.message})`;
      }
      
      setError(errorMsg + ' 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const processedData = useMemo(() => {
    if (data.length === 0) return [];

    const dataWithReturns = data.map((item, index) => {
      const prevClose = index > 0 ? data[index - 1].close : item.close;
      const dailyReturn = index > 0 ? (item.close - prevClose) / prevClose : 0;
      return {
        ...item,
        abs_daily_return: Math.abs(dailyReturn),
        year: new Date(item.date).getFullYear()
      };
    });

    const years = Array.from(new Set(dataWithReturns.map(d => d.year)))
      .filter((y): y is number => typeof y === 'number' && y >= 2007 && y <= 2026)
      .sort((a, b) => a - b);

    const results: YearlyResult[] = years.map(year => {
      const yearData = dataWithReturns.filter(d => d.year === year);
      if (yearData.length === 0) return null as any;

      const trading_days = yearData.length;
      const first_close = yearData[0].close;
      const last_close = yearData[yearData.length - 1].close;
      
      const sumAbsReturn = yearData.reduce((acc, curr) => acc + curr.abs_daily_return, 0);
      const avg_abs_daily_return_decimal = sumAbsReturn / trading_days;
      
      const index_change_decimal = (last_close / first_close) - 1;
      const index_change_pct = index_change_decimal * 100;
      const avg_abs_daily_return_pct = avg_abs_daily_return_decimal * 100;

      let direction: '상승' | '하락' | '보합' = '보합';
      if (index_change_decimal > 0) direction = '상승';
      else if (index_change_decimal < 0) direction = '하락';

      return {
        year,
        trading_days,
        first_close: Number(first_close.toFixed(2)),
        last_close: Number(last_close.toFixed(2)),
        avg_abs_daily_return_decimal: Number(avg_abs_daily_return_decimal.toFixed(8)),
        avg_abs_daily_return_pct: Number(avg_abs_daily_return_pct.toFixed(4)),
        index_change_decimal: Number(index_change_decimal.toFixed(8)),
        index_change_pct: Number(index_change_pct.toFixed(2)),
        direction
      };
    }).filter(r => r !== null);

    return results;
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA] text-[#1A1A1A]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-lg font-medium">KOSPI 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA] text-[#1A1A1A] p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md">
          <Info className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={fetchData}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1A1A] font-sans pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">KOSPI 변동성 분석기</h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">
            2007 - 2026 데이터 분석
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">최근 연도 수익률</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className={cn(
                "text-3xl font-bold",
                (processedData[processedData.length - 1]?.index_change_pct || 0) > 0 ? "text-green-600" : "text-red-600"
              )}>
                {processedData[processedData.length - 1]?.index_change_pct || 0}%
              </div>
              <p className="text-sm text-gray-400 mt-1">{processedData[processedData.length - 1]?.year}년 기준</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">평균 일간 변동성</span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">
                {processedData[processedData.length - 1]?.avg_abs_daily_return_pct || 0}%
              </div>
              <p className="text-sm text-gray-400 mt-1">최근 연도 절대 변동률 평균</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">총 분석 기간</span>
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {processedData.length}년
              </div>
              <p className="text-sm text-gray-400 mt-1">2007년부터 현재까지</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">연도별 지수 수익률 및 변동성 분석</h2>
            <div className="flex gap-4 text-xs font-medium">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> 수익률 상승</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> 수익률 하락</div>
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500"></div> 평균 절대 변동률</div>
            </div>
          </div>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="year" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#6B7280'}}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#6B7280'}}
                  tickFormatter={(val) => `${val}%`}
                  label={{ value: '수익률 (%)', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: 12, fill: '#6B7280' } }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#6B7280'}}
                  tickFormatter={(val) => `${val}%`}
                  label={{ value: '변동성 (%)', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 12, fill: '#6B7280' } }}
                />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  formatter={(value: number, name: string) => [`${value}%`, name === 'index_change_pct' ? '수익률' : '변동성']}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  formatter={(value) => value === 'index_change_pct' ? '지수 수익률' : '평균 절대 변동률'}
                />
                <ReferenceLine yAxisId="left" y={0} stroke="#9CA3AF" />
                <Bar yAxisId="left" dataKey="index_change_pct" radius={[4, 4, 0, 0]} barSize={40}>
                  {processedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.index_change_pct >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="avg_abs_daily_return_pct" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold">상세 분석 데이터</h2>
            <button 
              onClick={() => {
                const csv = [
                  ['Year', 'Trading Days', 'First Close', 'Last Close', 'Avg Abs Return (%)', 'Index Change (%)', 'Direction'],
                  ...processedData.map(r => [r.year, r.trading_days, r.first_close, r.last_close, r.avg_abs_daily_return_pct, r.index_change_pct, r.direction])
                ].map(e => e.join(",")).join("\n");
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `kospi_analysis_2007_2026.csv`;
                link.click();
              }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              CSV 다운로드
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-2">연도</th>
                  <th className="px-6 py-2">영업일</th>
                  <th className="px-6 py-2">연초 종가</th>
                  <th className="px-6 py-2">연말 종가</th>
                  <th className="px-6 py-2">평균 절대 변동률</th>
                  <th className="px-6 py-2">지수 수익률</th>
                  <th className="px-6 py-2">방향</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedData.map((row) => (
                  <tr key={row.year} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-2 font-bold text-gray-900">{row.year}</td>
                    <td className="px-6 py-2 text-gray-600">{row.trading_days}</td>
                    <td className="px-6 py-2 text-gray-600">{row.first_close.toLocaleString()}</td>
                    <td className="px-6 py-2 text-gray-600">{row.last_close.toLocaleString()}</td>
                    <td className="px-6 py-2 font-mono text-blue-600">{row.avg_abs_daily_return_pct}%</td>
                    <td className={cn(
                      "px-6 py-2 font-bold flex items-center gap-1",
                      row.index_change_pct > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {row.index_change_pct > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {row.index_change_pct}%
                    </td>
                    <td className="px-6 py-2">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        row.direction === '상승' ? "bg-green-100 text-green-700" : 
                        row.direction === '하락' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                      )}>
                        {row.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 text-center">
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-xs text-gray-500">
          <Info className="w-3 h-3" />
          <span>데이터 출처: Yahoo Finance (^KS11) | 분석 로직: FinanceDataReader 호환</span>
        </div>
      </footer>
    </div>
  );
}
