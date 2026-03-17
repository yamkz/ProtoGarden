const SmartGuide = {
  SNAP_DISTANCE: 5,
  guideElements: [],

  /**
   * Calculate snap for a moving/resizing node against all other nodes.
   * @param {Object} movingBounds - { x, y, width, height } of the node being moved
   * @param {string[]} excludeIds - IDs to exclude from comparison (the moving node(s))
   * @returns {{ snapX: number|null, snapY: number|null, guides: Array }}
   */
  calculate(movingBounds, excludeIds = []) {
    const nodes = Canvas.workspace.nodes.filter(n => !excludeIds.includes(n.id));
    if (nodes.length === 0) return { snapX: null, snapY: null, guides: [] };

    const moving = {
      left: movingBounds.x,
      right: movingBounds.x + movingBounds.width,
      top: movingBounds.y,
      bottom: movingBounds.y + movingBounds.height,
      centerX: movingBounds.x + movingBounds.width / 2,
      centerY: movingBounds.y + movingBounds.height / 2,
    };

    let bestDx = null;
    let bestDy = null;
    let bestDistX = this.SNAP_DISTANCE + 1;
    let bestDistY = this.SNAP_DISTANCE + 1;
    const guides = [];

    for (const other of nodes) {
      const target = {
        left: other.x,
        right: other.x + other.width,
        top: other.y,
        bottom: other.y + other.height,
        centerX: other.x + other.width / 2,
        centerY: other.y + other.height / 2,
      };

      // Horizontal snaps (X-axis: left, right, centerX of moving vs target)
      const xPairs = [
        { src: moving.left, tgt: target.left, edge: 'left-left' },
        { src: moving.left, tgt: target.right, edge: 'left-right' },
        { src: moving.right, tgt: target.left, edge: 'right-left' },
        { src: moving.right, tgt: target.right, edge: 'right-right' },
        { src: moving.centerX, tgt: target.centerX, edge: 'center-center-x' },
        { src: moving.left, tgt: target.centerX, edge: 'left-center' },
        { src: moving.right, tgt: target.centerX, edge: 'right-center' },
        { src: moving.centerX, tgt: target.left, edge: 'center-left' },
        { src: moving.centerX, tgt: target.right, edge: 'center-right' },
      ];

      for (const pair of xPairs) {
        const dist = Math.abs(pair.src - pair.tgt);
        if (dist <= this.SNAP_DISTANCE && dist < bestDistX) {
          bestDistX = dist;
          bestDx = pair.tgt - pair.src;
        }
      }

      // Vertical snaps (Y-axis)
      const yPairs = [
        { src: moving.top, tgt: target.top, edge: 'top-top' },
        { src: moving.top, tgt: target.bottom, edge: 'top-bottom' },
        { src: moving.bottom, tgt: target.top, edge: 'bottom-top' },
        { src: moving.bottom, tgt: target.bottom, edge: 'bottom-bottom' },
        { src: moving.centerY, tgt: target.centerY, edge: 'center-center-y' },
        { src: moving.top, tgt: target.centerY, edge: 'top-center' },
        { src: moving.bottom, tgt: target.centerY, edge: 'bottom-center' },
        { src: moving.centerY, tgt: target.top, edge: 'center-top' },
        { src: moving.centerY, tgt: target.bottom, edge: 'center-bottom' },
      ];

      for (const pair of yPairs) {
        const dist = Math.abs(pair.src - pair.tgt);
        if (dist <= this.SNAP_DISTANCE && dist < bestDistY) {
          bestDistY = dist;
          bestDy = pair.tgt - pair.src;
        }
      }
    }

    // Now compute guide lines at the snapped positions
    const snappedMoving = {
      left: moving.left + (bestDx || 0),
      right: moving.right + (bestDx || 0),
      top: moving.top + (bestDy || 0),
      bottom: moving.bottom + (bestDy || 0),
      centerX: moving.centerX + (bestDx || 0),
      centerY: moving.centerY + (bestDy || 0),
    };

    if (bestDx !== null) {
      // Find the X coordinate that snapped
      for (const other of nodes) {
        const target = {
          left: other.x, right: other.x + other.width,
          top: other.y, bottom: other.y + other.height,
          centerX: other.x + other.width / 2,
        };
        const snapPoints = [target.left, target.right, target.centerX];
        const movingPoints = [snappedMoving.left, snappedMoving.right, snappedMoving.centerX];
        for (const sp of snapPoints) {
          for (const mp of movingPoints) {
            if (Math.abs(sp - mp) < 0.5) {
              const minY = Math.min(snappedMoving.top, other.y);
              const maxY = Math.max(snappedMoving.bottom, other.y + other.height);
              guides.push({ type: 'vertical', x: sp, y1: minY, y2: maxY });
            }
          }
        }
      }
    }

    if (bestDy !== null) {
      for (const other of nodes) {
        const target = {
          left: other.x, right: other.x + other.width,
          top: other.y, bottom: other.y + other.height,
          centerY: other.y + other.height / 2,
        };
        const snapPoints = [target.top, target.bottom, target.centerY];
        const movingPoints = [snappedMoving.top, snappedMoving.bottom, snappedMoving.centerY];
        for (const sp of snapPoints) {
          for (const mp of movingPoints) {
            if (Math.abs(sp - mp) < 0.5) {
              const minX = Math.min(snappedMoving.left, other.x);
              const maxX = Math.max(snappedMoving.right, other.x + other.width);
              guides.push({ type: 'horizontal', y: sp, x1: minX, x2: maxX });
            }
          }
        }
      }
    }

    return {
      snapX: bestDx !== null ? bestDx : null,
      snapY: bestDy !== null ? bestDy : null,
      guides,
    };
  },

  /**
   * Show guide lines on the canvas container
   */
  showGuides(guides) {
    this.clearGuides();
    const container = document.getElementById('canvas-container');
    // Deduplicate guides
    const seen = new Set();
    for (const g of guides) {
      const key = g.type === 'vertical'
        ? `v:${Math.round(g.x)}`
        : `h:${Math.round(g.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const line = document.createElement('div');
      line.className = 'smart-guide';
      if (g.type === 'vertical') {
        line.style.left = `${g.x}px`;
        line.style.top = `${g.y1 - 20}px`;
        line.style.width = '1px';
        line.style.height = `${g.y2 - g.y1 + 40}px`;
      } else {
        line.style.left = `${g.x1 - 20}px`;
        line.style.top = `${g.y}px`;
        line.style.width = `${g.x2 - g.x1 + 40}px`;
        line.style.height = '1px';
      }
      container.appendChild(line);
      this.guideElements.push(line);
    }
  },

  clearGuides() {
    this.guideElements.forEach(el => el.remove());
    this.guideElements = [];
  },
};
