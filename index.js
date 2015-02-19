var libclang = require('libclang');
var extend   = require('extend');
var glob     = require('glob');



var tu        = libclang.TranslationUnit;//;
var Cursor    = libclang.Cursor;
var maps      = require('libclang/lib/dynamic_clang').CONSTANTS;



var kindIdToName = function(id){
  return maps.CXCursorKind[id].split('_')[1]
};


function CXXNode(c,p,cache){
  if(cache[c.hash])
    return cache[c.hash];
  if(!(this instanceof CXXNode))
    return new CXXNode(c,p,cache);

  self=this;

  var kind=c.kind;
  var hash=c.hash;
  cache[c.hash]=this;

  function init(){
    extend(self,{
      kind:kind,
      kindName:kindIdToName(kind),
      spelling:c.spelling,
      displayname:c.displayname,
      type:c.type.spelling,
      realType:c.type.canonical.spelling,
      result:c.type.result.spelling,
      loc: c.loc,
      hash:hash,
      nodes:[],
      parents:[],
      ast:[kindIdToName(kind)],
      ns:[],
    },c.location.presumedLocation);
    if(p){
      var P=new CXXNode(p,null,cache);
      link(self,P);
    }
    return self;
  }

  function link(N,P){
    P.nodes.push(N);
    N.parents = [P].concat(P.parents);
    N.ns =  P.ns.concat( ((P.spelling!='')?[P.spelling]:[]) );
    N.ast = P.ast.concat(N.kindName);
    return N;
  };

  function checkNode(cond,match){
    return function(node){
      var s=cond(node);
      if(s&1){
        match.push(node);
      }
      return s;
    }
  }

  this.find=function(cond,match,flat){
    match=match||[];
    var s=checkNode(cond,match)(this);
    if(!(s&2)&&!flat){
      this.nodes.forEach(function(node){
        node.find(cond,match);
      });
    }
    return match;
  };

  return init();
}


function CXXDB(opt){
  var self={};
  self.db={};
  self.cache={};
  self.root={};
  self.opt=opt||[];

  self.readFile=function(file,args){
    var index     = new libclang.Index();
    var src=tu.fromSource(index, file, opt );
    var root= CXXNode(src.cursor,null,self.cache);
    self.root[root.spelling]=root;
    src.cursor.visitChildren(self.visitor);
    return self;
  };

  self.read=function(file,args){

    var files=glob.sync(file);
    files.forEach(function(file){
      if(!(file in self.root)){
        self.readFile(file,extend({},opt,args));
      }
    });

    return files;
  }

  self.visitor=function(p){
    new CXXNode(this,p,self.cache);
    return 2;
  };

  self.Query=function(query){
    return Query(self)(query);
  }

  return self;
}




function QueryBuilder(){

  var self={};
  var data={next:null};

  self.From=function(file,args){
    data.From=function(db){
      var files=db.read(file);
      var roots = files.map(function(file){ return db.root[file]; });
      return roots;
    };
    return self;
  }

  self.Select=function Select(cond){
    data['Select']=function(N,match){
      return N.find(cond,match);
    };
    self.Select=self.SubSelect;
    return self;
  };

  self.As=function As(alias){
    data['As']=alias;
    return self;
  };

  self.Where=function Where(cond){
    data['filter']=cond;
    return self;
  };

  self.Do=function Do(task){
    data['Do']=task;
    return self;
  }

  self.Next=function Next(){
    var NextQuery=QueryBuilder();
    data.next=NextQuery.get();
    NextQuery.get=self.get;
    return NextQuery;
  };

  self.Sub=function Sub(sub){
    self.Do(function(match){
      for(var i in match){
        Query([match[i]],data.As,this)(sub);
      }
    });
    return self;
  };


  self.SubSelect=function SubSelect(cond){
    return self.Next().Select(cond);
  };


  self.data=function(){ return data; }
  self.get=function(){ return data; }

  return self;
}

function Query(DB,name,results){
  name=name||'haystack';
  return function(query){
    results=results||{};
    var Q=query.get();
    var db=DB;
    if(Q.From){
      db=Q.From(DB);
    }

    results[name]=db;
    var k=name;
    var i=0;
    do{

      var candidates=results[k];
      var match=candidates;
      if(Q.Select){

        k=Q.As||i;
        match=[];

        var keys=Object.keys(candidates);
        keys.forEach(function(key){
          Q.Select(candidates[key],match);
        });

        if(Q.filter){
          match=match.filter(Q.filter);
        }

        results[k]=match;
        ++i;

      }

      if(Q.Do){
        Q.Do.call(results,match);
      }

    }while(Q=Q.next);
    return results;
  };
}

var Select=function(sel){
  return QueryBuilder().Select(sel);
};

var From=function(sel){
  return QueryBuilder().From(sel);
};

function Children(){ return 3;}
function all(){ return 1;}


function EQ(name,str){
  return function(node){
    return (node[name]==str);
  }
}

var IFs  =EQ('kindName','IfStmt');
var Calls=EQ('kindName','CallExpr');
var Func =EQ('kindName','FunctionDecl');



var db=CXXDB(['-std=c++14']);
//db.read('**/*.h');








db.Query(
  From('test/test.h').
  Select(Func).As('Func').
  Where(function(m){ return m.loc<5; }).Sub(
    Select(IFs).As('IF').
    Do(function(){
      console.log(
        this.Func[0].File,
        this.Func[0].displayname,
        this.Func[0].loc,
        this.IF.length);
    })
  )
);
