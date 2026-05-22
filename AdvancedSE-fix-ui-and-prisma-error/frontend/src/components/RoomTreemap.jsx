import { useMemo, useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { Card, Typography } from 'antd';

const { Text } = Typography;

const ROOM_COLORS = {
  Bad: '#4096ff',
  Schlafzimmer: '#9254de',
  Wohnbereich: '#fa8c16',
  Küche: '#fadb14',
  Flur: '#13c2c2',
  Sonstiges: '#bfbfbf',
  'Nicht zugewiesen': '#f0f2f5'
};

const getOfferCount = (room) => {
  if (!room) return 0;

  const offerCollections = [
    room.offers,
    room.contractorOffers,
    room.handwerkerAngebote,
    room.professionalOffers
  ];
  const collection = offerCollections.find(Array.isArray);
  if (collection) return collection.length;

  const countFields = [
    room.offerCount,
    room.offersCount,
    room.contractorOfferCount,
    room.handwerkerAngeboteCount
  ];
  const count = countFields.find((value) => Number.isFinite(Number(value)));
  return count ? Number(count) : 0;
};

const formatSquareMeters = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  return Number.isFinite(Number(value)) ? String(value) : '0';
};

const clampTooltipPosition = (clientX, clientY, hasOfferCount) => {
  const tooltipWidth = Math.min(260, window.innerWidth - 16);
  const tooltipHeight = hasOfferCount ? 152 : 128;
  const offset = 14;

  return {
    x: Math.max(8, Math.min(clientX + offset, window.innerWidth - tooltipWidth - 8)),
    y: Math.max(8, Math.min(clientY + offset, window.innerHeight - tooltipHeight - 8))
  };
};

const TreemapTooltip = ({ tooltip }) => {
  if (!tooltip?.room) return null;

  const { room, x, y } = tooltip;

  return (
    <div
      className="pointer-events-none fixed z-50 w-[min(260px,calc(100vw-16px))] rounded-md bg-slate-800 p-3 text-white shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="text-sm font-bold leading-tight">{room.name}</div>
      <div className="mt-2 space-y-1 text-xs text-slate-200">
        <div>{formatSquareMeters(room.size)} m²</div>
        <div>{room.percentage.toFixed(1)}% der Gesamtfläche</div>
      </div>
      <div className="my-2 h-px bg-slate-600" />
      <div className="space-y-1 text-xs text-slate-300">
        <div>Kategorie: {room.type || 'Sonstiges'}</div>
        {room.offerCount > 0 ? (
          <div>Handwerker-Angebote: {room.offerCount}</div>
        ) : null}
      </div>
    </div>
  );
};

const CustomizedContent = (props) => {
  const {
    depth,
    x,
    y,
    width,
    height,
    name,
    size,
    type,
    isUnallocated,
    onTooltipMove,
    onTooltipLeave
  } = props;

  if (depth === 0) return null;

  const color = ROOM_COLORS[type] || ROOM_COLORS.Sonstiges;

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
        onMouseEnter={(event) => {
          if (!isUnallocated) {
            event.target.style.opacity = 1;
            onTooltipMove?.(event, props);
          }
        }}
        onMouseMove={(event) => {
          if (!isUnallocated) {
            onTooltipMove?.(event, props);
          }
        }}
        onMouseLeave={(event) => {
          if (!isUnallocated) {
            event.target.style.opacity = 0.9;
            onTooltipLeave?.();
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
          {formatSquareMeters(size)} m²
        </text>
      ) : null}
    </g>
  );
};

const RoomTreemap = ({ rooms, livingArea }) => {
  const [tooltip, setTooltip] = useState(null);
  const totalRoomArea = rooms.reduce((sum, room) => sum + (Number(room.area) || 0), 0);
  const totalArea = livingArea > 0 ? livingArea : totalRoomArea;

  const roomChildren = useMemo(() => rooms.map((room) => ({
    ...room,
    name: room.name,
    size: room.area,
    type: room.type || 'Sonstiges',
    percentage: totalArea > 0 ? ((Number(room.area) || 0) / totalArea) * 100 : 0,
    offerCount: getOfferCount(room),
    isUnallocated: false
  })), [rooms, totalArea]);

  const children = [...roomChildren];
  const remainingArea = (livingArea || 0) - totalRoomArea;
  if (remainingArea > 0) {
    children.push({
      name: 'Freie Fläche',
      size: remainingArea,
      type: 'Nicht zugewiesen',
      percentage: totalArea > 0 ? (remainingArea / totalArea) * 100 : 0,
      offerCount: 0,
      isUnallocated: true
    });
  }

  const data = [
    {
      name: 'Wohnfläche',
      children: children.length > 0 ? children : [{ name: 'Keine Räume', size: 1, type: 'Nicht zugewiesen', isUnallocated: true }]
    }
  ];

  const handleTooltipMove = (event, room) => {
    const position = clampTooltipPosition(event.clientX, event.clientY, room.offerCount > 0);
    setTooltip({ room, ...position });
  };

  return (
    <Card title="Proportionale Raumaufteilung" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}>
      <div style={{ height: 400, width: '100%' }} onMouseLeave={() => setTooltip(null)}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            ratio={4 / 3}
            stroke="#fff"
            content={<CustomizedContent onTooltipMove={handleTooltipMove} onTooltipLeave={() => setTooltip(null)} />}
            isAnimationActive={true}
          />
        </ResponsiveContainer>
      </div>
      <TreemapTooltip tooltip={tooltip} />
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
