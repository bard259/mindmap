import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Svg, { Path, Rect, Text as SvgText, G } from 'react-native-svg';

// Helper for handling click/touch events across platforms
const createPressHandler = (onClick, onLongPress) => {
  if (Platform.OS === 'web') {
    return {
      onClick,
      onMouseDown: () => {
        const timer = setTimeout(onLongPress, 500);
        window.addEventListener('mouseup', () => clearTimeout(timer), { once: true });
      }
    };
  }
  return {
    onPress: onClick,
    onLongPress
  };
};
import { generateMindMap, setDemoMode } from '../services/mindmap';

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
  const [selectedNode, setSelectedNode] = useState(null);
  const { width } = Dimensions.get('window');

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

  const renderNode = useCallback((node) => {
    return (
      <G key={node.id}>
        <Rect
          x={node.x - node.w/2}
          y={node.y - node.h/2}
          rx={Math.min(node.h/2, 26)}
          ry={Math.min(node.h/2, 26)}
          width={node.w}
          height={node.h}
          fill="#1b2333"
          stroke="#2f3b52"
          strokeWidth={1.5}
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
          {node.expanded ? "−" : "＋"}
        </SvgText>
      </G>
    );
  }, []);

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
        stroke="#3b6aff"
        strokeWidth={2.2}
        fill="none"
        opacity={0.95}
      />
    );
  }, [nodes]);

  const initialize = useCallback(async (subject) => {
    try {
      const data = await generateMindMap(subject);
      const rootNode = addNode({ 
        label: subject,
        description: data.description
      });
      setSelectedNode(rootNode);
    } catch (error) {
      console.error('Failed to load description:', error);
      const rootNode = addNode({ 
        label: subject,
        description: "Loading description failed. Please try again."
      });
      setSelectedNode(rootNode);
    }
  }, [addNode]);

  React.useEffect(() => {
    initialize('Finance');
  }, [initialize]);

  React.useEffect(() => {
    if (nodes.size > 0) {
      const nodesClone = new Map(
        Array.from(nodes.entries()).map(([id, node]) => [id, { ...node }])
      );
      layout(nodesClone, edges);
      setNodes(nodesClone);
    }
  }, [edges, layout]);

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
          <TouchableOpacity
            style={styles.button}
            {...createPressHandler(
              () => initialize(subject),
              null
            )}
          >
            <Text style={styles.buttonText}>Generate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            {...createPressHandler(
              () => {
                setDemoMode(true);
                initialize('Finance');
              },
              null
            )}
          >
            <Text style={styles.buttonText}>Demo</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Tip: <Text style={styles.bold}>tap</Text> any node to show its description, <Text style={styles.bold}>double tap</Text> to expand/collapse.</Text>
        
        <View style={styles.grid}>
          <View style={styles.svgContainer}>
            <Svg width="100%" height={520} style={styles.svg}>
              {edges.map(renderEdge)}
              {Array.from(nodes.values()).map((node) => {
                const handleLongPress = async () => {
                  if (node.expanded) {
                    removeSubtree(node.id);
                    setNodes(prev => {
                      const next = new Map(prev);
                      const n = next.get(node.id);
                      if (n) {
                        next.set(node.id, { ...n, expanded: false });
                      }
                      return next;
                    });
                  } else {
                    try {
                      const data = await generateMindMap(node.label);
                      setNodes(prev => {
                        const next = new Map(prev);
                        const n = next.get(node.id);
                        if (n) {
                          next.set(node.id, { 
                            ...n, 
                            description: data.description || n.description,
                            expanded: true 
                          });
                        }
                        return next;
                      });
                      // Add all subcategories in a single batch
                      const newNodes = data.subcategories.map(sc => ({
                        label: sc.name,
                        description: sc.description,
                        parentId: node.id
                      }));
                      newNodes.forEach(addNode);
                    } catch (error) {
                      console.error('Failed to expand node:', error);
                    }
                  }
                };

                return (
                  <G 
                    key={node.id}
                    {...createPressHandler(
                      () => setSelectedNode(node),
                      handleLongPress
                    )}
                  >
                    <Rect
                      x={node.x - node.w/2}
                      y={node.y - node.h/2}
                      rx={Math.min(node.h/2, 26)}
                      ry={Math.min(node.h/2, 26)}
                      width={node.w}
                      height={node.h}
                      fill="#1b2333"
                      stroke="#2f3b52"
                      strokeWidth={1.5}
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
                      {node.expanded ? "−" : "＋"}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </View>
          <View style={styles.description}>
            <Text style={styles.descTitle}>{selectedNode?.label || ''}</Text>
            <Text style={styles.descText}>{selectedNode?.description || 'Select a node to see its description.'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c10',
    padding: 24,
  },
  card: {
    backgroundColor: '#11141a',
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
    color: '#e7ecf2',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  form: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#263041',
    color: '#e7ecf2',
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
    color: '#e7ecf2',
    fontWeight: '600',
  },
  hint: {
    color: '#9fb0c3',
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
    color: '#e7ecf2',
    marginBottom: 6,
    fontWeight: '600',
  },
  descText: {
    fontSize: 15,
    color: '#9fb0c3',
    lineHeight: 22,
  },
});