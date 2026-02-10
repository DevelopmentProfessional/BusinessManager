`import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { eachDayOfInterval, startOfMonth, endOfMonth, format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Generate mock data for the current month
const generateMockData = () => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const days = eachDayOfInterval({ start, end });

  const labels = days.map(day => format(day, 'd'));
  const data = days.map(() => Math.floor(Math.random() * 2000) + 500); // Random sales between 500 and 2500

  return {
    labels,
    datasets: [
      {
        label: 'Daily Sales',
        data,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: `Sales for ${format(new Date(), 'MMMM yyyy')}`,
      font: {
        size: 18
      }
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: function(value) {
          return '$' + value;
        }
      }
    }
  }
};

const SalesChartModal = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  const chartData = generateMockData();

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.chartContainer}>
          <Line data={chartData} options={chartOptions} />
        </div>
        <div style={styles.buttonContainer}>
          <button onClick={onClose} style={styles.button}>Close</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    padding: '20px',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  chartContainer: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};

export default SalesChartModal;
