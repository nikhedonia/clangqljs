# clangqljs
nodeJS module for querying c++ source with libclang

Goal of this library is to create a DSL for querying cpp files to output statistics and make it easy to work with
clang's AST for code transformations.


Curently index.js executes the following command:
```javascript

db.Query(
  From('test/test.h'). // could also use From('**.h')
  Select(Func).As('Func'). //select all functions and name results 'Func'
  Where(function(m){ return m.loc<5; }) //where lines of code<5
  .Sub( //make subselect [it passes an array of results to the next function]
    Select(IFs).As('IF'). // select all If-statments from resultset and name results 'IF'
    Do(function(){ // do with each result the folowing...
      console.log( 
        this.Func[0].File,
        this.Func[0].displayname,
        this.Func[0].loc, 
        this.IF.length);
      })
    )
  );

```


##ToDO:

* export methods
* implement more predicates
* allow parsing files(using eval?)
* add implement a less verbose css like syntax

