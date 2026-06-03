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

interface MonthlyResult {
  month: number;
  monthLabel: string;
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
  const [viewType, setViewType] = useState<'yearly' | 'monthly'>('yearly');
  const [selectedYear, setSelectedYear] = useState<number>(2026);

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
      .filter((y): y is number => typeof y === 'number' && y >= 1990 && y <= 2026)
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

  // Set the default selected year to the latest available year in processedData
  useEffect(() => {
    if (processedData.length > 0) {
      const latestYear = processedData[processedData.length - 1].year;
      setSelectedYear(latestYear);
    }
  }, [processedData]);

  // List of all years available in the analysis (1990 to 2026)
  const availableYears = useMemo(() => {
    return processedData.map(d => d.year).sort((a, b) => b - a); // descending order
  }, [processedData]);

  // Selected year statistics for overview cards
  const selectedYearStats = useMemo(() => {
    return processedData.find(d => d.year === selectedYear) || processedData[processedData.length - 1];
  }, [processedData, selectedYear]);

  // Calculate monthly stats for the selected year
  const monthlyData = useMemo(() => {
    if (data.length === 0 || !selectedYear) return [];

    // Calculate daily absolute return for the entire dataset
    const dataWithReturns = data.map((item, index) => {
      const prevClose = index > 0 ? data[index - 1].close : item.close;
      return {
        ...item,
        prevClose,
        abs_daily_return: index > 0 ? Math.abs((item.close - prevClose) / prevClose) : 0,
        year: new Date(item.date).getFullYear(),
        month: new Date(item.date).getMonth() + 1 // 1 ~ 12
      };
    });

    const yearData = dataWithReturns.filter(d => d.year === selectedYear);
    if (yearData.length === 0) return [];

    const months = Array.from(new Set(yearData.map(d => d.month))).sort((a: number, b: number) => a - b);

    const results: MonthlyResult[] = months.map(m => {
      const monthRows = yearData.filter(d => d.month === m);
      if (monthRows.length === 0) return null as any;

      const trading_days = monthRows.length;
      const first_row = monthRows[0];
      const last_row = monthRows[monthRows.length - 1];
      
      const first_close = first_row.close;
      const last_close = last_row.close;

      // Find preceding close in global data if available (to calculate correct mouth return compared to prior end-of-month)
      const overallIndex = dataWithReturns.findIndex(d => d.date === first_row.date);
      const baselineClose = overallIndex > 0 ? dataWithReturns[overallIndex - 1].close : first_close;

      const index_change_decimal = (last_close / baselineClose) - 1;
      const index_change_pct = index_change_decimal * 100;

      const sumAbsReturn = monthRows.reduce((acc, curr) => acc + curr.abs_daily_return, 0);
      const avg_abs_daily_return_decimal = sumAbsReturn / trading_days;
      const avg_abs_daily_return_pct = avg_abs_daily_return_decimal * 100;

      let direction: '상승' | '하락' | '보합' = '보합';
      if (index_change_decimal > 0) direction = '상승';
      else if (index_change_decimal < 0) direction = '하락';

      return {
        month: m,
        monthLabel: `${m}월`,
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
  }, [data, selectedYear]);

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
            1990 - 2026 데이터 분석
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Toggle and Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900">분석 단위 설정</h2>
            <p className="text-sm text-gray-500">지수 수익률 및 변동성의 분석 기준 단위를 선택하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setViewType('yearly')}
                className={cn(
                  "px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all",
                  viewType === 'yearly'
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                연단위 (Yearly)
              </button>
              <button
                type="button"
                onClick={() => setViewType('monthly')}
                className={cn(
                  "px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all",
                  viewType === 'monthly'
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                월단위 (Monthly)
              </button>
            </div>
            {viewType === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">분석 연도:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl px-3 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                {viewType === 'yearly' ? "최근 연도 수익률" : `${selectedYear}년 지수 수익률`}
              </span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className={cn(
                "text-3xl font-bold",
                (viewType === 'yearly' 
                  ? (processedData[processedData.length - 1]?.index_change_pct || 0) 
                  : (selectedYearStats?.index_change_pct || 0)) > 0 ? "text-green-600" : "text-red-600"
              )}>
                {viewType === 'yearly' 
                  ? (processedData[processedData.length - 1]?.index_change_pct || 0) 
                  : (selectedYearStats?.index_change_pct || 0)}%
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {viewType === 'yearly' 
                  ? `${processedData[processedData.length - 1]?.year}년 기준` 
                  : `${selectedYear}년 전체 기간`}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                {viewType === 'yearly' ? "평균 일간 변동성" : `${selectedYear}년 평균 일간 변동성`}
              </span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">
                {viewType === 'yearly' 
                  ? (processedData[processedData.length - 1]?.avg_abs_daily_return_pct || 0) 
                  : (selectedYearStats?.avg_abs_daily_return_pct || 0)}%
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {viewType === 'yearly' ? "최근 연도 절대 변동률 평균" : "1일 평균 절대 변동률"}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                {viewType === 'yearly' ? "총 분석 기간" : `${selectedYear}년 총 영업일`}
              </span>
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {viewType === 'yearly' ? `${processedData.length}년` : `${selectedYearStats?.trading_days || 0}일`}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {viewType === 'yearly' ? "1990년부터 현재까지" : "실제 거래 영업일수"}
              </p>
            </div>
          </div>
        </div>

        {/* Combo Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">
              {viewType === 'yearly' ? "연도별 지수 수익률 및 변동성 분석" : `${selectedYear}년 월별 지수 수익률 및 변동성 분석`}
            </h2>
            <div className="flex gap-4 text-xs font-medium">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> 수익률 상승</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> 수익률 하락</div>
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500"></div> 평균 절대 변동률</div>
            </div>
          </div>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={viewType === 'yearly' ? processedData : monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey={viewType === 'yearly' ? "year" : "monthLabel"} 
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
                  formatter={(value: number, name: string) => [
                    `${value}%`, 
                    name === 'index_change_pct' ? '수익률' : '평균 절대 변동률'
                  ]}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  formatter={(value) => value === 'index_change_pct' 
                    ? (viewType === 'yearly' ? '지수 수익률 (연간)' : '지수 수익률 (월간)') 
                    : (viewType === 'yearly' ? '평균 절대 변동률 (연간)' : '평균 절대 변동률 (월간)')
                  }
                />
                <ReferenceLine yAxisId="left" y={0} stroke="#9CA3AF" />
                <Bar yAxisId="left" dataKey="index_change_pct" radius={[4, 4, 0, 0]} barSize={viewType === 'yearly' ? undefined : 45}>
                  {(viewType === 'yearly' ? processedData : monthlyData).map((entry, index) => (
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

        {/* Detailed Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {viewType === 'yearly' ? "연도별 상세 분석 데이터" : `${selectedYear}년 월별 상세 분석 데이터`}
            </h2>
            <button 
              onClick={() => {
                let csvContent = "";
                if (viewType === 'yearly') {
                  csvContent = [
                    ['Year', 'Trading Days', 'First Close', 'Last Close', 'Avg Abs Return (%)', 'Index Change (%)', 'Direction'],
                    ...processedData.map(r => [r.year, r.trading_days, r.first_close, r.last_close, r.avg_abs_daily_return_pct, r.index_change_pct, r.direction])
                  ].map(e => e.join(",")).join("\n");
                } else {
                  csvContent = [
                    ['Month', 'Trading Days', 'First Close', 'Last Close', 'Avg Abs Return (%)', 'Index Change (%)', 'Direction'],
                    ...monthlyData.map(r => [r.monthLabel, r.trading_days, r.first_close, r.last_close, r.avg_abs_daily_return_pct, r.index_change_pct, r.direction])
                  ].map(e => e.join(",")).join("\n");
                }
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = viewType === 'yearly'
                  ? `kospi_annual_analysis_1990_2026.csv`
                  : `kospi_monthly_analysis_${selectedYear}.csv`;
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
                  <th className="px-6 py-2">{viewType === 'yearly' ? "연도" : "월"}</th>
                  <th className="px-6 py-2">영업일</th>
                  <th className="px-6 py-2">{viewType === 'yearly' ? "연초 종가" : "월초 종가"}</th>
                  <th className="px-6 py-2">{viewType === 'yearly' ? "연말 종가" : "월말 종가"}</th>
                  <th className="px-6 py-2">평균 절대 변동률</th>
                  <th className="px-6 py-2">{viewType === 'yearly' ? "지수 수익률" : "월간 수익률"}</th>
                  <th className="px-6 py-2">방향</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(viewType === 'yearly' ? processedData : monthlyData).map((row) => {
                  const label = 'year' in row ? row.year : row.monthLabel;
                  const key = 'year' in row ? row.year : row.month;
                  return (
                    <tr key={key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-2 font-bold text-gray-900">{label}</td>
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
                  );
                })}
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
