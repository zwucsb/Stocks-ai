import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isAddingStock, setIsAddingStock] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // Fetch watchlist on component mount
  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Fetch quotes when watchlist changes
  useEffect(() => {
    if (watchlist.length > 0) {
      fetchQuotes();
      fetchComparisonData();
    }
  }, [watchlist, selectedPeriod]);

  const fetchWatchlist = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/watchlist`);
      const data = await response.json();
      setWatchlist(data.watchlist || []);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  };

  const fetchQuotes = async () => {
    const newQuotes = {};
    for (const stock of watchlist) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/quote/${stock.symbol}`);
        const data = await response.json();
        newQuotes[stock.symbol] = data;
      } catch (error) {
        console.error(`Error fetching quote for ${stock.symbol}:`, error);
      }
    }
    setQuotes(newQuotes);
  };

  const fetchComparisonData = async () => {
    if (watchlist.length === 0) return;
    
    setIsLoadingChart(true);
    try {
      const symbols = watchlist.map(stock => stock.symbol).join(',');
      const response = await fetch(`${BACKEND_URL}/api/comparison?symbols=${symbols}&period=${selectedPeriod}`);
      const data = await response.json();
      setComparisonData(data);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const searchStocks = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/search/${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching stocks:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addToWatchlist = async (stock) => {
    setIsAddingStock(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: stock.symbol,
          name: stock.name
        }),
      });

      if (response.ok) {
        fetchWatchlist();
        setSearchQuery('');
        setSearchResults([]);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add stock');
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      alert('Failed to add stock to watchlist');
    } finally {
      setIsAddingStock(false);
    }
  };

  const removeFromWatchlist = async (symbol) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/watchlist/${symbol}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchWatchlist();
      } else {
        alert('Failed to remove stock');
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      alert('Failed to remove stock from watchlist');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change, changePercent) => {
    const isPositive = change >= 0;
    const sign = isPositive ? '+' : '';
    return `${sign}${formatPrice(change)} (${sign}${parseFloat(changePercent).toFixed(2)}%)`;
  };

  const generateChartData = () => {
    if (!comparisonData) return null;

    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
    const datasets = [];

    Object.keys(comparisonData.data).forEach((symbol, index) => {
      const data = comparisonData.data[symbol];
      if (data && data.length > 0) {
        datasets.push({
          label: symbol,
          data: data.map(point => ({
            x: point.date,
            y: point.close
          })),
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + '20',
          fill: false,
          tension: 0.1
        });
      }
    });

    return datasets;
  };

  const chartData = generateChartData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Stock Dashboard</h1>
                <p className="text-gray-600">Track and compare your favorite stocks</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 rounded-lg text-white font-semibold">
                {watchlist.length} Stocks Tracked
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add Stocks to Watchlist</h2>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchStocks(e.target.value);
              }}
              placeholder="Search for stocks (e.g., AAPL, GOOGL, TSLA)..."
              className="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-4 top-3.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-xl bg-white shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((stock, index) => (
                <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="font-semibold text-gray-900">{stock.symbol}</div>
                    <div className="text-sm text-gray-600">{stock.name}</div>
                    <div className="text-xs text-gray-500">{stock.region} • {stock.currency}</div>
                  </div>
                  <button
                    onClick={() => addToWatchlist(stock)}
                    disabled={isAddingStock}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isAddingStock ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist Grid */}
        {watchlist.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {watchlist.map((stock) => {
              const quote = quotes[stock.symbol];
              return (
                <div key={stock.symbol} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{stock.symbol}</h3>
                      <p className="text-sm text-gray-600 truncate">{stock.name}</p>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(stock.symbol)}
                      className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {quote ? (
                    <div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {formatPrice(quote.price)}
                      </div>
                      <div className={`text-sm font-medium ${quote.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatChange(quote.change, quote.change_percent)}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>Open: {formatPrice(quote.open)}</div>
                        <div>High: {formatPrice(quote.high)}</div>
                        <div>Low: {formatPrice(quote.low)}</div>
                        <div>Vol: {(quote.volume / 1000000).toFixed(1)}M</div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-pulse">
                      <div className="h-8 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded mb-3"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Chart Section */}
        {watchlist.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Historical Comparison</h2>
              <div className="flex space-x-2">
                {['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedPeriod === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingChart ? (
              <div className="h-96 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : chartData && chartData.length > 0 ? (
              <div className="h-96">
                <StockChart data={chartData} />
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p>Add stocks to your watchlist to see comparison charts</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {watchlist.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Building Your Watchlist</h3>
              <p className="text-gray-600 mb-6">Search and add stocks you want to track. See real-time prices and compare historical performance with beautiful overlaid charts.</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">💡 Try searching for popular stocks like:</p>
                <p className="text-blue-600 mt-1">AAPL, GOOGL, TSLA, MSFT, AMZN</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple Chart Component using Canvas
const StockChart = ({ data }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set up margins
    const margin = { top: 20, right: 50, bottom: 60, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.bottom - margin.top;

    // Find min/max values across all datasets
    let allValues = [];
    let allDates = [];
    
    data.forEach(dataset => {
      dataset.data.forEach(point => {
        allValues.push(point.y);
        allDates.push(new Date(point.x));
      });
    });

    if (allValues.length === 0) return;

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Helper functions
    const xScale = (date) => {
      const timestamp = new Date(date).getTime();
      return margin.left + ((timestamp - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * chartWidth;
    };

    const yScale = (value) => {
      return margin.top + ((maxValue - value) / (maxValue - minValue)) * chartHeight;
    };

    // Draw grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Draw datasets
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
    
    data.forEach((dataset, index) => {
      if (dataset.data.length === 0) return;

      ctx.strokeStyle = colors[index % colors.length];
      ctx.lineWidth = 3;
      ctx.beginPath();

      dataset.data.forEach((point, pointIndex) => {
        const x = xScale(point.x);
        const y = yScale(point.y);
        
        if (pointIndex === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });

    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // Y-axis labels (prices)
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (i / 5) * (maxValue - minValue);
      const y = margin.top + ((5 - i) / 5) * chartHeight;
      ctx.textAlign = 'right';
      ctx.fillText(`$${value.toFixed(2)}`, margin.left - 10, y + 4);
    }

    // Legend
    data.forEach((dataset, index) => {
      const x = margin.left + index * 100;
      const y = height - 20;
      
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(x, y - 6, 12, 12);
      
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'left';
      ctx.fillText(dataset.label, x + 18, y + 4);
    });

  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      className="w-full h-full"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

export default App;