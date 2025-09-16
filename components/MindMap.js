import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Dimensions, Platform, ActivityIndicator } from 'react-native';
import Svg, { Path, Rect, Text as SvgText, G } from 'react-native-svg';

// 用于存储最后一次点击时间的全局变量（每个节点独立）
const lastTapTimes = new Map();
import { generateMindMap, setDemoMode, canon } from '../services/mindmap';

const BASE_X = 140;      // root x
const X_STEP = 240;      // horizontal gap per level
const LEAF_GAP = 96;     // vertical gap allocated per leaf
const TOP_PAD = 60;
const BOTTOM_PAD = 60;
const ROOT_H = 48;
const H = 42;

export default function MindMap() {
  const [nodes, setNodes] = useState(new Map());
  const [edges, setEdges] = useState([]);
  const [subject, setSubject] = useState('Finance');
  const [perspective, setPerspective] = useState('a high school student');
  const [purpose, setPurpose] = useState('out of curiosity');
  const [selectedNode, setSelectedNode] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingNode, setLoadingNode] = useState(null);
  const { width } = Dimensions.get('window');

  // Pan and zoom state
  const [panning, setPanning] = useState(false);
  const [startPt, setStartPt] = useState({ x: 0, y: 0 });
  const [startView, setStartView] = useState({ x: 0, y: 0 });

  const clamp = useCallback((v, a, b) => Math.max(a, Math.min(b, v)), []);

  const measureWidth = useCallback((text) => {
    return Math.max(140, Math.min(260, 28 + Math.max(10, text.length) * 8));
  }, []);

  const nextId = useCallback((label = 'n') => {
    const idCounter = nodes.size;
    return `${label}-${(idCounter + 1).toString(36)}`;
  }, [nodes]);

  const addNode = useCallback(({ label, description = '', parentId = null }) => {
    const id = nextId(label);
    const node = {
      id,
      label,
      description,
      expanded: false,
      parentId,
      childIds: [],
      level: 0,
      x: BASE_X,
      y: 0,
      w: measureWidth(label),
      h: H
    };

    setNodes(prev => {
      const next = new Map(prev);
      if (parentId) {
        const parent = next.get(parentId);
        if (parent) {
          parent.childIds.push(id);
          next.set(parentId, parent);
        }
      }
      next.set(id, node);
      return next;
    });

    if (parentId) {
      setEdges(prev => [...prev, { from: parentId, to: id }]);
    }

    return node;
  }, [nextId, measureWidth]);

  const removeSubtree = useCallback((nodeId) => {
    setNodes(prev => {
      const next = new Map(prev);
      const node = next.get(nodeId);
      if (!node) return next;

      const removeNode = (id) => {
        const n = next.get(id);
        if (!n) return;
        n.childIds.forEach(removeNode);
        next.delete(id);
      };
      removeNode(nodeId);

      if (node.parentId) {
        const parent = next.get(node.parentId);
        if (parent) {
          parent.childIds = parent.childIds.filter(id => id !== nodeId);
          next.set(node.parentId, parent);
        }
      }

      return next;
    });

    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
  }, []);

  const layout = useCallback((nodes, edges) => {
    const root = Array.from(nodes.values()).find(n => !n.parentId);
    if (!root) return;

    const leafCount = (node) => {
      if (!node.childIds.length) return 1;
      return node.childIds.reduce((sum, id) => {
        const child = nodes.get(id);
        return sum + (child ? leafCount(child) : 0);
      }, 0);
    };

    const layoutNode = (nodeId, level, topY) => {
      const node = nodes.get(nodeId);
      if (!node) return 0;

      const leaves = leafCount(node);
      const subH = Math.max(1, leaves) * LEAF_GAP;

      const updatedNode = {
        ...node,
        level,
        w: measureWidth(node.label),
        h: level === 0 ? ROOT_H : H,
        x: BASE_X + level * X_STEP,
        y: topY + subH / 2
      };
      nodes.set(nodeId, updatedNode);

      let cursor = topY;
      for (const childId of node.childIds) {
        cursor += layoutNode(childId, level + 1, cursor);
      }
      return subH;
    };

    layoutNode(root.id, 0, TOP_PAD);
  }, [measureWidth]);

  const handleNodeClick = useCallback((node) => {
    if (!node || loading) return;
    
    setSelectedNode(node);
    
    // Web平台特定的动画
    if (Platform.OS === 'web') {
      requestAnimationFrame(() => {
        const descElement = document.querySelector('.description');
        if (descElement) {
          descElement.style.opacity = '0';
          requestAnimationFrame(() => {
            descElement.style.opacity = '1';
          });
        }
      });
    }
  }, [loading]);

  const handleNodeExpand = useCallback(async (node) => {
    if (loading) return; // 如果正在加载，阻止操作
    
    setLoadingNode(node.id);
    setLoading(true);

    // 立即更新展开状态，提供即时反馈
    setNodes(prev => {
      const next = new Map(prev);
      const n = next.get(node.id);
      if (n) {
        next.set(node.id, { ...n, expanded: !n.expanded });
      }
      return next;
    });

    if (node.expanded) {
      removeSubtree(node.id);
      setLoading(false);
      setLoadingNode(null);
    } else {
      try {
        // 获取节点路径
        const path = [];
        let current = node;
        while (current) {
          path.unshift({
            name: current.label,
            description: current.description
          });
          current = current.parentId ? nodes.get(current.parentId) : null;
        }

        // 获取要排除的标签
        const exclude = path.map(p => canon(p.name));
        exclude.push(canon(node.label));

        // 异步获取数据
        const data = await generateMindMap({
          subject: node.label,
          perspective,
          purpose,
          context: path.map(p => p.name).join(" > "),
          exclude,
          path
        });

        // 更新节点描述
        setNodes(prev => {
          const next = new Map(prev);
          const n = next.get(node.id);
          if (n) {
            next.set(node.id, { 
              ...n, 
              description: data.description || n.description
            });
          }
          return next;
        });

        // 批量添加子节点
        const newNodes = data.subcategories.map(sc => ({
          label: sc.name,
          description: sc.description,
          parentId: node.id
        }));
        newNodes.forEach(addNode);
      } catch (error) {
        console.error('Failed to expand node:', error);
        // 如果失败，恢复展开状态
        setNodes(prev => {
          const next = new Map(prev);
          const n = next.get(node.id);
          if (n) {
            next.set(node.id, { ...n, expanded: false });
          }
          return next;
        });
      } finally {
        setLoading(false);
        setLoadingNode(null);
      }
    }
  }, [nodes, removeSubtree, addNode, perspective, purpose]);

  const handleNodePress = useCallback((e, node) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    const now = Date.now();
    const lastTap = lastTapTimes.get(node.id) || 0;
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // 双击
      handleNodeExpand(node);
      lastTapTimes.set(node.id, 0);
    } else {
      // 单击
      handleNodeClick(node);
      lastTapTimes.set(node.id, now);
    }
  }, [handleNodeClick, handleNodeExpand]);

  const renderNode = useCallback((node) => {
    const isNodeLoading = loadingNode === node.id;
    
    const eventHandlers = Platform.OS === 'web' 
      ? {
          onClick: (e) => handleNodePress(e, node),
          onDoubleClick: (e) => {
            e.stopPropagation();
            handleNodeExpand(node);
          }
        }
      : {
          onPress: (e) => handleNodePress(e, node)
        };
    
    return (
      <G 
        key={node.id}
        className="node"
        {...eventHandlers}
        opacity={loading && !isNodeLoading ? 0.5 : 1}
      >
        <Rect
          x={node.x - node.w/2}
          y={node.y - node.h/2}
          rx={Math.min(node.h/2, 26)}
          ry={Math.min(node.h/2, 26)}
          width={node.w}
          height={node.h}
          fill={isNodeLoading ? "#2a3854" : "#1b2333"}
          stroke={isNodeLoading ? "#3b6aff" : "#2f3b52"}
          strokeWidth={isNodeLoading ? 2 : 1.5}
        />
        <SvgText
          x={node.x}
          y={node.y + 5}
          textAnchor="middle"
          fill="#e7ecf2"
          fontSize={14}
        >
          {node.label}
        </SvgText>
        <SvgText
          x={node.x + node.w/2 - 10}
          y={node.y - node.h/2 + 14}
          textAnchor="end"
          fill="#b6c7dd"
          fontSize={11}
          opacity={0.9}
        >
          {isNodeLoading ? "..." : node.expanded ? "−" : "＋"}
        </SvgText>
      </G>
    );
  }, [nodes, removeSubtree, addNode, perspective, purpose]);

  const renderEdge = useCallback((edge) => {
    const a = nodes.get(edge.from);
    const b = nodes.get(edge.to);
    if (!a || !b) return null;

    const dx = (b.x - a.x) * 0.55;
    const path = `M ${a.x + a.w/2} ${a.y} C ${a.x + a.w/2 + dx} ${a.y}, ${b.x - b.w/2 - dx} ${b.y}, ${b.x - b.w/2} ${b.y}`;

    return (
      <Path
        key={`${edge.from}-${edge.to}`}
        d={path}
        stroke={cssVars.accent}
        strokeWidth={2.2}
        fill="none"
        opacity={0.95}
      />
    );
  }, [nodes]);

  const initialize = useCallback(async ({ subject, perspective, purpose }) => {
    if (loading) return;
    
    setLoading(true);
    // 清除现有节点
    setNodes(new Map());
    setEdges([]);
    setSelectedNode(null);
    
    try {
      const data = await generateMindMap({
        subject,
        perspective,
        purpose,
        context: subject,
        exclude: [],
        path: []
      });
      
      // 只创建根节点，不自动展开
      const rootNode = addNode({ 
        label: subject,
        description: data.description,
        expanded: false
      });
      
      setSelectedNode(rootNode);
    } catch (error) {
      console.error('Failed to load description:', error);
      const rootNode = addNode({ 
        label: subject,
        description: "Loading description failed. Please try again."
      });
      setSelectedNode(rootNode);
    } finally {
      setLoading(false);
    }
  }, [addNode]);

  // 移除自动初始化，只在用户点击 Generate 时创建节点

  React.useEffect(() => {
    if (nodes.size > 0) {
      const nodesClone = new Map(
        Array.from(nodes.entries()).map(([id, node]) => [id, { ...node }])
      );
      layout(nodesClone, edges);
      setNodes(nodesClone);
    }
  }, [edges, layout]);

  // Keyboard navigation (仅在 Web 平台)
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e) => {
      const step = 40;
      const zoomFactor = 1.12;

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "0"].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case "ArrowLeft":
          setView(v => ({ ...v, x: v.x + step }));
          break;
        case "ArrowRight":
          setView(v => ({ ...v, x: v.x - step }));
          break;
        case "ArrowUp":
          setView(v => ({ ...v, y: v.y + step }));
          break;
        case "ArrowDown":
          setView(v => ({ ...v, y: v.y - step }));
          break;
        case "+":
        case "=":
          setView(v => ({ ...v, scale: clamp(v.scale * zoomFactor, 0.5, 2.6) }));
          break;
        case "-":
        case "_":
          setView(v => ({ ...v, scale: clamp(v.scale / zoomFactor, 0.5, 2.6) }));
          break;
        case "0":
          setView({ x: 0, y: 0, scale: 1 });
          break;
      }
    };

    // 只在 Web 平台添加键盘事件监听
    const win = typeof window !== 'undefined' ? window : null;
    if (win) {
      win.addEventListener("keydown", handleKeyDown);
      return () => win.removeEventListener("keydown", handleKeyDown);
    }
  }, [clamp]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Interactive Mind-Map Teacher</Text>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject (e.g., Finance)"
            placeholderTextColor="#9fb0c3"
          />
          <TextInput
            style={styles.input}
            value={perspective}
            onChangeText={setPerspective}
            placeholder="Perspective (e.g., a high school student)"
            placeholderTextColor="#9fb0c3"
          />
          <TextInput
            style={styles.input}
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Purpose (e.g., out of curiosity)"
            placeholderTextColor="#9fb0c3"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={() => initialize({
              subject,
              perspective,
              purpose
            })}
          >
            <Text style={styles.buttonText}>Generate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setDemoMode(true);
              setSubject('Finance');
              setPerspective('a high school student');
              setPurpose('out of curiosity');
              initialize({
                subject: 'Finance',
                perspective: 'a high school student',
                purpose: 'out of curiosity'
              });
            }}
          >
            <Text style={styles.buttonText}>Demo</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Tip: <Text style={styles.bold}>tap</Text> any node to show its description, <Text style={styles.bold}>double tap</Text> to expand/collapse.
          Use <Text style={styles.bold}>arrow keys</Text> to pan, <Text style={styles.bold}>+/-</Text> to zoom, <Text style={styles.bold}>0</Text> to reset view.
        </Text>
        
        <View style={styles.grid}>
          <View style={styles.svgContainer}>
            {loading && (
              <View style={[styles.loadingOverlay, { borderRadius: 16 }]}>
                <ActivityIndicator size="large" color="#3b6aff" />
                <Text style={styles.loadingText}>Generating mind map...</Text>
              </View>
            )}
            <Svg 
              width="100%" 
              height={520} 
              style={styles.svg}
              onTouchStart={(e) => {
                // Web 平台检查节点点击
                if (Platform.OS === 'web') {
                  if (e.target.closest?.(".node")) return;
                }
                setPanning(true);
                const touch = e.nativeEvent.touches[0];
                setStartPt({ 
                  x: Platform.OS === 'web' ? touch.clientX : touch.pageX,
                  y: Platform.OS === 'web' ? touch.clientY : touch.pageY
                });
                setStartView({ ...view });
              }}
              onTouchMove={(e) => {
                if (!panning) return;
                const touch = e.nativeEvent.touches[0];
                const currentX = Platform.OS === 'web' ? touch.clientX : touch.pageX;
                const currentY = Platform.OS === 'web' ? touch.clientY : touch.pageY;
                const dx = currentX - startPt.x;
                const dy = currentY - startPt.y;
                setView({
                  ...view,
                  x: startView.x + dx,
                  y: startView.y + dy
                });
              }}
              onTouchEnd={() => setPanning(false)}
              onResponderTerminate={() => setPanning(false)}
          onWheel={(e) => {
            const zooming = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey;
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = e.nativeEvent.clientX - rect.left;
            const my = e.nativeEvent.clientY - rect.top;

            if (zooming) {
              const factor = e.nativeEvent.deltaY < 0 ? 1.1 : 0.9;
              const nextScale = clamp(view.scale * factor, 0.5, 2.6);
              setView({
                x: mx - (mx - view.x) * (nextScale / view.scale),
                y: my - (my - view.y) * (nextScale / view.scale),
                scale: nextScale
              });
            } else {
              setView({
                ...view,
                x: view.x - e.nativeEvent.deltaX,
                y: view.y - e.nativeEvent.deltaY
              });
            }
          }}
          style={{ touchAction: 'none' }}
            >
              <G id="viewport" transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
                {edges.map(renderEdge)}
                {Array.from(nodes.values()).map(node => renderNode(node))}
              </G>
            </Svg>
          </View>
      <View style={styles.description} className="description">
        <Text style={styles.descTitle}>{selectedNode?.label || ''}</Text>
        <Text style={styles.descText}>{selectedNode?.description || 'Select a node to see its description.'}</Text>
      </View>
        </View>
      </View>
    </View>
  );
}

// CSS variables from reference implementation
const cssVars = {
  bg: '#0b0c10',
  card: '#11141a',
  ink: '#e7ecf2',
  muted: '#9fb0c3',
  accent: '#3b6aff'
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cssVars.bg,
    padding: 24,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 12, 16, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#e7ecf2',
    marginTop: 12,
    fontSize: 16,
  },
  card: {
    backgroundColor: cssVars.card,
    borderRadius: 18,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: cssVars.ink,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  form: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    minWidth: 200,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#263041',
    color: cssVars.ink,
    backgroundColor: '#141923',
  },
  button: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#141923',
    borderWidth: 1,
    borderColor: '#263041',
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    color: cssVars.ink,
    fontWeight: '600',
  },
  hint: {
    color: cssVars.muted,
    fontSize: 12,
    marginTop: 6,
  },
  bold: {
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    gap: 18,
  },
  svgContainer: {
    flex: 2,
  },
  svg: {
    backgroundColor: '#0f1320',
    borderRadius: 16,
  },
  description: {
    flex: 1,
    maxWidth: '30%',
  },
  descTitle: {
    fontSize: 18,
    color: cssVars.ink,
    marginBottom: 6,
    fontWeight: '600',
  },
  descText: {
    fontSize: 15,
    color: cssVars.muted,
    lineHeight: 22,
  },
});