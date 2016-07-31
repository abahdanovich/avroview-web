var MIN_FONT_SIZE = 16;
var MAX_FONT_SIZE = 26;

function openFile(schema, max_depth){
  var all_nodes = [];
  var graph;

  var dom = {
    container: '#container',
    search: 'input.search',
    searchBar: '#search-bar',
    spinner: '#spinner'
  };

  var data = parseTree(schema, max_depth, all_nodes);
  $(dom.spinner).show();

  setTimeout(function(){
    graph = drawGraph(data, $(dom.container), graph);  
    $(dom.searchBar).css('display', 'flex');
    $(dom.spinner).hide();
  }, 50);

  var highlightNodes = function(){
    var text = $(dom.search).val();
    var fields = $('input:checkbox:checked', dom.searchBar)
      .map(function(){
        return $(this).attr('name');
      }).get();

    graph.selectNodes(getNodesIds(all_nodes, text, fields));
  };

  var highlight_debounced = _.debounce(highlightNodes, 500);

  $(dom.search).off().on('keyup', highlight_debounced);
  $('input:checkbox', dom.searchBar).off().on('click', highlight_debounced);
}

function getNodesIds(all_nodes, text, fields) {
  if(_.isEmpty(text)) {
    return [];
  }

  var re = new RegExp(text, "i");
  var nodes = all_nodes.filter(function(node){
    return _.some(fields, function(field){
      return node.hasOwnProperty(field) && node[field].match(re);
    });
  });

  return nodes.map(function(node){
    return node.id;
  });
}

function parseTree(root, max_depth, all_nodes) {
  var nodes = [];
  var edges = [];

  var label = root.name || 'unnamed_root';
  var path = root.namespace ? (root.namespace+'.'+label) : label;

  var node = {
    id: 1,
    label: label,
    shape: 'box',
    radius: 1,
    borderWidth: 2,
    fontSize: MAX_FONT_SIZE,
    fontColor: 'red',
    title: path
  };
  nodes.push(node);

  all_nodes.push({
    id: node.id,
    name: root.name || '',
    description: path
  });

  root.fields.forEach(function(field) {
    parseLevel(field, nodes, edges, 1, 1, max_depth, root.namespace, [], all_nodes);
  });

  return  {
    nodes: nodes,
    edges: edges
  };
}

function parseLevel(root, nodes, edges, parent_id, level, max_depth, namespace, ancestors, all_nodes) {
  var node_id = nodes.length + 1;
  var type_def;

  if(Array.isArray(root.type) && root.type.length > 1 && $.isPlainObject(root.type[1])) {
    type_def = root.type[1];
  } else if($.isPlainObject(root.type) && root.hasOwnProperty('type')) {
    type_def = root.type;
  }

  var decorate = function(src, type_name) {
    switch (type_name) {
      case 'record': return '<'+src+'>';
      case 'array': return '['+src+']';
      case 'map':  return '{'+src+'}';
      case 'enum': return ':'+src+':';
      case 'string': return '_'+src+'_';
      case 'long':
      case 'int': return '#'+src+'#';
      case 'double': return '~'+src+'~';
      case 'boolean': return '!'+src+'!';
      default: return src;
    }
  };

  var getColor = function(type_name) {
    switch (type_name) {
      case 'string': return 'blue';
      case 'double':
      case 'int':
      case 'long': return 'green';
      case 'boolean': return 'maroon';
      case 'array':
      case 'map':
      case 'enum':
      case 'record':  return 'purple';
      default: return 'black';
    }
  };

  var getDescription = function(doc, type_name, type_def, ancestors) {
    var result = [];

    if (ancestors && ancestors.length) {
      result.push(ancestors.join('.'));
    }

    if (type_name) {
      var str;

      if (type_name === 'enum' && type_def.hasOwnProperty('symbols')) {
        str = (type_name + ':<br />' + type_def.symbols.join(', '));
      } else if (type_name === 'record' && type_def.hasOwnProperty('name')) {
        str = type_def.name;
        if (namespace) {
          str = (namespace + '.' + str);
        }
        str = (type_name + ':<br />' + str);
      } else {
        str = type_name;
      }

      result.push(str);
    }

    if (doc) {
      result.push(doc);
    }

    return result.join('<br />');
  };

  var type_name;

  if (type_def) {
    type_name = type_def.type;
  } else if (Array.isArray(root.type) && root.type.length > 1){
    type_name = root.type[1];
  } else {
    type_name = root.type;
  }

  var new_namespace;

  if (type_def && type_def.hasOwnProperty('namespace')) {
    new_namespace = type_def.namespace;
  }

  var name = root.name || 'unnamed';
  var path_element;

  if (type_name && type_name === 'array') {
    path_element = name + '[]';
  } else {
    path_element = name;
  }

  var label = decorate(name, type_name);
  var new_ancestors = ancestors.concat([path_element]);
  var title = getDescription(root.doc, type_name, type_def, new_ancestors);

  var node = {
    id: node_id,
    label: label,
    fontSize: Math.max(MIN_FONT_SIZE, MAX_FONT_SIZE-(3*level)),
    shape: 'ellipse',
    title: title,
    fontColor: getColor(type_name)
  };

  nodes.push(node);

  all_nodes.push({
    id: node.id,
    name: root.name || '',
    description: title
  });

  edges.push({
    from: parent_id,
    to: node_id
  });

  var max_depth_reached = (max_depth && (level >= max_depth));

  if((! max_depth_reached) && type_def) {
    var fields;

    if (type_def.hasOwnProperty('fields')) {
      fields = type_def.fields;
    }

    if (type_def.hasOwnProperty('items') && type_def.items.hasOwnProperty('fields')) {
      fields = type_def.items.fields;
    }

    if (fields) {
      fields.forEach(function(field) {
        parseLevel(field, nodes, edges, node_id, level+1, max_depth, new_namespace ? new_namespace : namespace, new_ancestors, all_nodes);
      });
    }
  }
}

function drawGraph(data, container, graph) {
  var options = {
    edges: {
      style: "arrow",
      color: {
        highlight: "green"
      },
      widthSelectionMultiplier: 3      
    },
    nodes: {
      color: {
        background: '#97C2FC',
        border: '#2B7CE9',
        highlight: {
          background: 'yellow',
          border: '#2B7CE9'
        }
      },
    },
    // hierarchicalLayout: {
    //   layout: 'direction',
    //   direction: 'LR'
    // },
    // stabilize: true,
    // stabilizationIterations: 10,
    // smoothCurves: false,
    // selectable: false,
    // dragNetwork: false,
    // dragNodes: false,
    // zoomable: false
  };

  if (! graph) {
    container.empty();
    return new vis.Network(container[0], data, options);
  } else {
    graph.setOptions(options);
    graph.setData(data);
    return graph;
  }
}


window.onload = function() {
  $('#toolbar input[type=file]').on('change', function(e){
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
      var schema = JSON.parse(reader.result);
      openFile(schema);
    };
    reader.readAsText(file);
  });
};
