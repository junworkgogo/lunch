/* 登入迎賓動畫，依序轉身、整理背帶、微笑。 */
(function () {
  'use strict';

  var sequenceMs = 1500;
  var fadeMs = 180;
  var turn = [0, 0.13, 0.25, 0.40, 1];
  var grip = [0, 0.13, 0.25, 0.40, 0.60, 0.73, 0.83, 1];
  var nod = [0, 0.40, 0.59, 0.75, 0.84, 1];
  var catMark = 'M-8 -3 C-8 -9 -7 -11 -3 -7 Q0 -8 3 -7 C7 -11 8 -9 8 -3 C12 8 -12 8 -8 -3 Z';
  var overlay = null;
  var started = 0;
  var failSafe = null;
  var overlayReduced = false;

  function reducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function deliveryCat(animate) {
    function motion(attribute, times, values, transformType) {
      if (!animate) return '';
      var tag = transformType ? 'animateTransform' : 'animate';
      var type = transformType ? ' type="' + transformType + '"' : '';
      var splines = times.slice(1).map(function () { return '.42 0 .58 1'; }).join(';');
      return '<' + tag + ' attributeName="' + attribute + '"' + type + ' dur="' + sequenceMs + 'ms" fill="freeze" calcMode="spline" keyTimes="' + times.join(';') + '" keySplines="' + splines + '" values="' + values.join(';') + '"/>';
    }

    function path(attributes, poses, times) {
      return '<path d="' + poses[poses.length - 1] + '"' + (attributes ? ' ' + attributes : '') + '>' + motion('d', times || turn, poses) + '</path>';
    }

    var boxFront = 'M49 117 C49 110 53 106 62 106 C95 106 145 106 178 106 L178 106 C187 106 191 110 191 117 L191 191 C191 199 187 203 178 203 L62 203 C53 203 49 199 49 191 Z';
    // Each changing silhouette uses the same SVG path commands in every pose.
    var boxSideOutline = 'M119 106 C119 99 123 95 132 95 C154 94 173 93 195 96 L203 98 C212 100 216 103 216 110 L216 179 C216 186 213 189 205 191 L148 201 C138 203 130 198 129 190 Z';
    var boxAngledOutline = 'M98 111 C98 104 103 100 112 98 C137 94 168 91 190 95 L199 97 C207 99 211 103 211 111 L211 177 C211 185 207 190 199 193 L157 205 C149 207 137 203 135 193 Z';
    var boxSidePanel = 'M152 118 L214 112 L214 178 Q214 186 204 189 L153 198 Z';
    var boxAngledPanel = 'M165 116 L209 112 L209 177 Q208 186 198 191 L165 201 Z';
    var boxHiddenPanel = 'M179 116 L189 116 L189 189 Q188 197 179 201 L179 201 Z';
    var sideLid = 'M119 106 C119 99 123 95 132 95 C154 94 173 93 195 96 L203 98 C212 100 216 103 216 110 L216 122 L121 131 Z';
    var angledLid = 'M98 111 C98 104 103 100 112 98 C137 94 168 91 190 95 L199 97 C207 99 211 103 211 111 L211 122 L102 133 Z';
    var frontLid = 'M46 117 C46 110 51 104 60 104 C98 104 143 104 180 104 L180 104 C189 104 194 110 194 117 L194 123 L46 123 Z';

    var bodySide = 'M82 119 C70 131 66 154 69 177 L74 202 C75 209 77 212 83 213 L101 213 C106 213 106 208 107 201 C109 208 110 213 115 213 L135 213 C141 213 143 208 145 202 L149 182 C153 156 141 128 126 116 Z';
    var bodyAngled = 'M87 119 C76 132 72 154 75 177 L79 204 C80 210 84 214 90 214 L104 214 C110 214 110 209 111 202 C113 209 114 214 120 214 L142 214 C148 214 152 211 153 204 L157 179 C161 152 147 126 134 116 Z';
    var bodyFront = 'M93 117 C82 128 79 152 81 177 L85 202 C86 209 89 214 95 214 L108 214 C114 214 117 210 120 202 C123 210 126 214 132 214 L145 214 C151 214 154 209 155 202 L159 177 C161 152 158 128 147 117 Z';
    var strapNearSide = 'M124 121 C112 124 103 136 103 152 C103 173 112 187 136 193';
    var strapNearAngled = 'M130 120 C119 124 112 135 114 154 C116 173 128 189 145 194';
    var strapNearFront = 'M147 119 C141 128 143 142 145 158 C148 179 154 188 153 195';
    var strapNearLifted = 'M147 119 C141 127 143 140 150 150 C156 168 156 184 153 195';
    var strapFarSide = 'M84 121 C78 128 77 139 77 155 C76 168 75 181 78 192';
    var strapFarAngled = 'M92 120 C85 126 83 139 85 155 C87 173 84 184 84 193';
    var strapFarFront = 'M93 119 C99 128 97 142 95 158 C92 179 86 188 87 195';
    var strapFarLifted = 'M93 119 C99 127 97 140 90 150 C84 168 84 184 87 195';

    var leftSide = 'M81 124 C75 133 69 150 67 167 C65 179 69 187 75 188 C81 189 85 183 84 176 C82 165 84 147 87 137 C87 131 84 126 81 124 Z';
    var leftAngled = 'M86 123 C78 132 70 149 69 168 C67 180 71 189 78 190 C85 191 89 183 88 176 C86 165 89 147 93 135 C93 129 90 125 86 123 Z';
    var leftDown = 'M89 123 C78 133 69 154 67 172 C65 185 70 194 79 192 C87 190 90 183 89 174 C87 162 93 144 99 133 C99 127 95 123 89 123 Z';
    var leftLift = 'M89 123 C80 132 69 146 67 160 C65 173 71 180 79 177 C87 175 90 165 97 164 C109 161 110 151 102 146 C98 143 92 146 86 151 Z';
    var leftSettled = 'M89 123 C80 132 69 148 67 162 C65 175 71 182 79 179 C87 177 90 167 97 166 C109 163 110 153 102 148 C98 145 92 148 86 153 Z';
    var rightSide = 'M126 122 C136 123 144 136 146 153 C147 167 145 185 136 190 C127 195 119 189 119 179 C120 168 126 161 125 148 C124 138 122 130 126 122 Z';
    var rightAngled = 'M134 122 C144 123 153 137 155 157 C156 173 153 187 145 191 C136 195 128 189 129 179 C131 168 134 159 133 148 C132 138 130 130 134 122 Z';
    var rightDown = 'M151 123 C162 133 171 154 173 172 C175 185 170 194 161 192 C153 190 150 183 151 174 C153 162 147 144 141 133 C141 127 145 123 151 123 Z';
    var rightLift = 'M151 123 C160 132 171 146 173 160 C175 173 169 180 161 177 C153 175 150 165 143 164 C131 161 130 151 138 146 C142 143 148 146 154 151 Z';
    var rightSettled = 'M151 123 C160 132 171 148 173 162 C175 175 169 182 161 179 C153 177 150 167 143 166 C131 163 130 153 138 148 C142 145 148 148 154 153 Z';

    var faceSide = 'M47 66 C61 53 92 48 114 57 C134 64 143 84 141 101 C138 118 119 129 95 130 C71 128 50 124 42 111 C35 101 39 96 43 91 C43 83 43 73 47 66 Z';
    var faceAngled = 'M53 62 C69 51 103 49 126 57 C148 64 157 82 155 100 C152 119 132 131 108 131 C84 132 63 126 54 112 C48 104 48 98 49 91 C49 80 49 70 53 62 Z';
    var faceFront = 'M64 70 C77 54 99 51 120 51 C146 51 167 58 176 73 C183 88 180 107 169 119 C159 129 140 134 120 134 C99 134 81 129 71 119 C61 109 57 90 64 70 Z';
    var earLeftSide = 'M62 56 C62 42 66 20 76 17 C83 15 96 24 103 38 Z';
    var earLeftAngled = 'M63 56 C62 39 65 20 75 16 C84 13 100 24 108 38 Z';
    var earLeftFront = 'M71 62 C66 45 64 19 75 15 C85 12 102 23 110 35 Z';
    var earRightSide = 'M100 46 C109 32 120 15 132 18 C143 22 151 51 147 70 Z';
    var earRightAngled = 'M108 45 C118 31 130 14 141 17 C152 20 162 47 159 67 Z';
    var earRightFront = 'M130 35 C138 23 155 12 165 15 C176 19 174 45 169 62 Z';
    var crownSide = 'M51 64 C59 44 77 34 94 36 C116 36 139 49 148 68 C149 72 151 79 146 85 C118 80 78 72 51 64 Z';
    var crownAngled = 'M53 65 C63 45 83 33 103 34 C125 33 150 45 159 66 C161 72 161 77 157 82 C123 74 84 73 53 65 Z';
    var crownFront = 'M64 70 C69 49 94 31 120 31 C146 31 171 49 176 70 C177 72 177 75 174 77 C143 61 97 61 66 77 Z';
    var brimSide = 'M48 58 C63 54 91 58 113 68 C130 75 143 82 146 85 C140 89 125 86 112 83 C86 77 52 73 31 72 C26 71.5 25.75 69 29 66.125 C32.25 63.25 39 60 48 58 Z';
    var brimAngled = 'M54 62 C72 53 104 54 126 62 C144 68 155 76 157 82 C154 86 140 84 126 80 C99 74 66 74 46 80 C40.5 81 37.5 78.5 38.5 74.75 C39.25 71 44 66 54 62 Z';
    var brimFront = 'M69 61 C83 52 101 49 120 49 C139 49 157 52 171 61 C184 69 191 83 177 91 C175 78 149 68 120 68 C91 68 65 78 63 91 C49 83 56 69 69 61 Z';

    var farClaws = 'M102 152 Q105 152 107 155 M101 158 Q104 158 105 160';
    var nearClaws = 'M138 152 Q135 152 133 155 M139 158 Q136 158 135 160';

    return '<svg class="mascot-delivery-cat" viewBox="0 0 240 228" width="240" height="228" fill="none" aria-hidden="true" focusable="false">' +
      '<ellipse cx="120" cy="215" rx="76" ry="8" fill="#402715" opacity=".07"/>' +
      '<g stroke="#232422" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">' +
        path('fill="#f3c69f"', [boxSideOutline, boxSideOutline, boxAngledOutline, boxFront, boxFront]) +
        '<g opacity="0">' + motion('opacity', turn, [1, 1, 1, 0, 0]) +
          path('fill="#ebae81" stroke="none"', [boxSidePanel, boxSidePanel, boxAngledPanel, boxHiddenPanel, boxHiddenPanel]) +
          path('stroke-width="3.4"', [
            'M151 107 L152 197', 'M151 107 L152 197', 'M165 105 L165 201', 'M178 107 L178 199', 'M178 107 L178 199'
          ]) +
        '</g>' +
        path('fill="#f8d8bc"', [sideLid, sideLid, angledLid, frontLid, frontLid]) +
        '<g transform="translate(120 154)">' + motion('transform', turn, ['184 152', '184 152', '187 154', '120 154', '120 154'], 'translate') +
          '<path fill="#fff9ef" stroke-width="2.8" d="' + catMark + '"/>' +
        '</g>' +
        path('fill="#fffaf1"', [bodySide, bodySide, bodyAngled, bodyFront, bodyFront]) +
        path('stroke-width="11"', [strapFarSide, strapFarSide, strapFarAngled, strapFarFront, strapFarLifted, strapFarFront, strapFarFront, strapFarFront], grip) +
        path('stroke="#f8d8bc" stroke-width="5"', [strapFarSide, strapFarSide, strapFarAngled, strapFarFront, strapFarLifted, strapFarFront, strapFarFront, strapFarFront], grip) +
        path('stroke-width="11"', [strapNearSide, strapNearSide, strapNearAngled, strapNearFront, strapNearLifted, strapNearFront, strapNearFront, strapNearFront], grip) +
        path('stroke="#f8d8bc" stroke-width="5"', [strapNearSide, strapNearSide, strapNearAngled, strapNearFront, strapNearLifted, strapNearFront, strapNearFront, strapNearFront], grip) +
        path('fill="#fffaf1"', [leftSide, leftSide, leftAngled, leftDown, leftLift, leftSettled, leftSettled, leftSettled], grip) +
        path('fill="#fffaf1"', [rightSide, rightSide, rightAngled, rightDown, rightLift, rightSettled, rightSettled, rightSettled], grip) +
        '<g opacity="1" stroke-width="2.4">' + motion('opacity', grip, [0, 0, 0, 0, 1, 1, 1, 1]) +
          motion('transform', grip, ['0 -2', '0 -2', '0 -2', '0 -2', '0 -2', '0 0', '0 0', '0 0'], 'translate') +
          '<path d="' + farClaws + '"/><path d="' + nearClaws + '"/>' +
        '</g>' +
        '<g opacity="0" stroke="#ac613e" stroke-width="3.2">' +
          motion('opacity', [0, 0.64, 0.76, 0.92, 1], [0, 0, 1, 0, 0]) +
          '<path d="M47 103 L41 96 M41 112 L33 108 M193 103 L199 96 M199 112 L207 108"/>' +
        '</g>' +
        '<g>' + motion('transform', nod, ['0 0', '0 0', '0 8', '0 -2', '0 0', '0 0'], 'translate') +
          path('fill="#fff4e8"', [earLeftSide, earLeftSide, earLeftAngled, earLeftFront, earLeftFront]) +
          path('fill="#fff4e8"', [earRightSide, earRightSide, earRightAngled, earRightFront, earRightFront]) +
          path('fill="#fffaf1"', [faceSide, faceSide, faceAngled, faceFront, faceFront]) +
          path('fill="#fff6ea"', [crownSide, crownSide, crownAngled, crownFront, crownFront]) +
          path('fill="#fffaf1"', [brimSide, brimSide, brimAngled, brimFront, brimFront]) +
          '<g transform="translate(120 42)" fill="#232422" stroke-width="1">' +
            motion('transform', turn, ['79 47', '79 47', '95 45', '120 42', '120 42'], 'translate') +
            '<path d="' + catMark + '" transform="scale(.78)"/>' +
          '</g>' +
          '<g stroke-width="3.6">' +
            path('', [
              'M70 105 Q74 104 79 104 M71 111 Q75 111 79 113', 'M70 105 Q74 104 79 104 M71 111 Q75 111 79 113',
              'M63 104 Q67 102 71 104 M64 111 Q67 109 71 109', 'M75 103 Q79 101 85 103 M77 111 Q81 109 86 108',
              'M75 103 Q79 101 85 103 M77 111 Q81 109 86 108'
            ]) +
            '<g opacity="1">' + motion('opacity', turn, [0, 0, 0.85, 1, 1]) +
              path('', [
                'M123 104 Q128 102 132 103 M122 109 Q128 109 132 111', 'M123 104 Q128 102 132 103 M122 109 Q128 109 132 111',
                'M131 102 Q136 100 141 102 M130 108 Q135 108 139 110', 'M155 103 Q161 101 165 103 M154 108 Q159 109 163 111',
                'M155 103 Q161 101 165 103 M154 108 Q159 109 163 111'
              ]) +
            '</g>' +
            path('', [
              'M42 104 C43 108 48 109 50 104 C51 107 55 108 57 105', 'M42 104 C43 108 48 109 50 104 C51 107 55 108 57 105',
              'M78 105 C81 110 87 110 90 104 C92 110 98 109 101 104', 'M110 105 C113 111 118 111 120 104 C122 111 127 111 130 105',
              'M110 105 C113 111 118 111 120 104 C122 111 127 111 130 105'
            ]) +
            '<circle cx="120" cy="102.5" r="2" fill="#232422" stroke="none">' + motion('cx', turn, [50, 50, 90, 120, 120]) + '</circle>' +
          '</g>' +
          '<g fill="#232422" stroke="none">' +
            '<ellipse cx="99" cy="94" rx="4.1" ry="6.3" opacity="0">' + motion('cx', turn, [60, 60, 75, 99, 99]) +
              motion('opacity', [0, 0.80, 0.86, 1], [1, 1, 0, 0]) +
              motion('ry', nod, [6.3, 6.3, 3.5, 6.3, 6.3, 6.3]) + '</ellipse>' +
            '<ellipse cx="141" cy="94" rx="4.1" ry="6.3" opacity="0">' + motion('cx', turn, [72, 72, 117, 141, 141]) +
              motion('opacity', [0, 0.13, 0.25, 0.80, 0.86, 1], [0, 0, 1, 1, 0, 0]) +
              motion('ry', nod, [6.3, 6.3, 3.5, 6.3, 6.3, 6.3]) + '</ellipse>' +
          '</g>' +
          '<path d="M92 96 C94 89 103 89 106 96 M134 96 C137 89 146 89 148 96" stroke-width="4.2" opacity="1">' +
            motion('opacity', [0, 0.80, 0.86, 1], [0, 0, 1, 1]) +
          '</path>' +
        '</g>' +
      '</g>' +
    '</svg>';
  }

  function html(inline, animate) {
    return '<div class="mascot-scene mascot-delivery-scene' + (inline ? ' mascot-inline' : '') + '">' +
      deliveryCat(animate) + '<h2>Hi！要來點什麼</h2></div>';
  }

  function hide() {
    if (failSafe) clearTimeout(failSafe);
    failSafe = null;
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  function show() {
    if (overlay) return;
    started = Date.now();
    overlayReduced = reducedMotion();
    overlay = document.createElement('div');
    overlay.className = 'mascot-welcome';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = html(false, !overlayReduced);
    document.body.appendChild(overlay);
    var svg = overlay.querySelector('svg');
    if (!overlayReduced && svg && typeof svg.setCurrentTime === 'function') svg.setCurrentTime(0);
    failSafe = setTimeout(hide, 15000);
  }

  function finish() {
    if (!overlay) show();
    var target = overlay;
    var reduce = overlayReduced || reducedMotion();
    var delay = reduce ? 0 : Math.max(0, sequenceMs - (Date.now() - started));
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (overlay !== target) {
          resolve();
          return;
        }
        target.classList.add('leaving');
        setTimeout(function () {
          if (overlay === target) hide();
          resolve();
        }, reduce ? 0 : fadeMs);
      }, delay);
    });
  }

  window.LunchMascot = {
    show: show,
    hide: hide,
    finish: finish,
    loadingHtml: function () {
      return '<div class="page member-page mascot-loading" role="status" aria-live="polite">' + html(true, !reducedMotion()) + '</div>';
    }
  };
})();
