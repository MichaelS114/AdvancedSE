import React from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, Typography } from 'antd';

const { Text } = Typography;

const ROOM_COLORS = {
  'Bad': '#4096ff', // Blau
  'Schlafzimmer': '#9254de', // Lila
  'Wohnbereich': '#fa8c16', // Orange
  'Küche': '#fadb14', // Gelb
  'Flur': '#13c2c2', // Türkis
  'Sonstiges': '#bfbfbf', // Grau
  'Nicht zugewiesen': '#f0f2f5' // Hellgrau
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ background: '#fff', border: '1px solid #d9d9d9', padding: '8px 12px', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Text strong style={{ display: 'block' }}>{data.name}</Text>
        <Text type="secondary" style={{ display: 'block' }}>Typ: {data.type || 'N/A'}</Text>
        <Text strong style={{ color: '#1677ff' }}>{data.size} m²</Text>
      </div>
    );
  }
  return null;
};

const CustomizedContent = (props) => {
  const { root, depth, x, y, width, height, index, payload, colors, rank, name, size, type } = props;

  // Render nothing for the root node to avoid overlapping
  if (depth === 0) return null;

  const color = ROOM_COLORS[type] || ROOM_COLORS['Sonstiges'];
  const isUnallocated = type === 'Nicht zugewiesen';

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#fff',
          strokeWidth: 2,
          transition: 'all 0.3s ease',
          opacity: isUnallocated ? 0.7 : 0.9,
          cursor: isUnallocated ? 'default' : 'pointer'
        }}
        onMouseEnter={(e) => {
          if (!isUnallocated) {
            e.target.style.opacity = 1;
          }
        }}
        onMouseLeave={(e) => {
          if (!isUnallocated) {
            e.target.style.opacity = 0.9;
          }
        }}
      />
      {width > 50 && height > 30 ? (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill={isUnallocated ? '#595959' : '#fff'}
          fontSize={14}
          fontWeight="bold"
          dominantBaseline="central"
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      ) : null}
      {width > 50 && height > 50 ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + 16}
          textAnchor="middle"
          fill={isUnallocated ? '#8c8c8c' : '#fff'}
          fontSize={12}
          dominantBaseline="central"
          style={{ pointerEvents: 'none', opacity: 0.8 }}
        >
          {size} m²
        </text>
      ) : null}
    </g>
  );
};

const RoomTreemap = ({ rooms, livingArea }) => {
  const totalRoomArea = rooms.reduce((sum, r) => sum + (r.area || 0), 0);
  
  // Format data for Treemap
  const children = rooms.map(room => ({
    name: room.name,
    size: room.area,
    type: room.type || 'Sonstiges'
  }));

  const remainingArea = (livingArea || 0) - totalRoomArea;
  if (remainingArea > 0) {
    children.push({
      name: 'Freie Fläche',
      size: remainingArea,
      type: 'Nicht zugewiesen'
    });
  }

  const data = [
    {
      name: 'Wohnfläche',
      children: children.length > 0 ? children : [{ name: 'Keine Räume', size: 1, type: 'Nicht zugewiesen' }]
    }
  ];

  return (
    <Card title="Proportionale Raumaufteilung" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}>
      <div style={{ height: 400, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            ratio={4 / 3}
            stroke="#fff"
            content={<CustomizedContent />}
            isAnimationActive={true}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
        {Object.entries(ROOM_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 2 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{type}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default RoomTreemap;
