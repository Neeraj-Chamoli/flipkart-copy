var express = require("express");
let passport=require("passport");
let JWTStrategy=require("passport-jwt").Strategy;
let ExtractJWT=require("passport-jwt").ExtractJwt;
let jwt=require("jsonwebtoken");
let fs = require("fs");

let app = express();
app.use(express.json());
app.use(function (req, res, next) {
res.header("Access-Control-Allow-Origin", "*");
res.header(
"Access-Control-Allow-Headers",
"Origin, X-Requested-With, Content-Type, Accept ,Authorization"
); 
res.header("Access-Control-Expose-Headers","Authorization");
res.header("Access-Control-Allow-Credentials", true);
next();
});
app.use(passport.initialize());
var port = process.env.PORT || 2410;
app.listen(port, () => console.log(`Node app listening on port ${port}!`));

let {mobileData}=require('./dataFile.js');
let { brandPics,mobiles,reviews,pincodes }=mobileData;

const users=[{id:201,fname:"test",gender:'Male',phone:'+917854621350',emailId:'test@gmail.com',password:'test123',role:'user'},
{id:202,fname:"admin",gender:'Male',phone:'+919454621350',emailId:'admin@test.com',password:'admin123',role:'admin'}
];

const editDetails=[];

let wishList=[];
let cartList=[];
let searchHistory=[];

const params={
    jwtFromRequest:ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey:"jwtsecret89445"
}

let strategyAll = new JWTStrategy(params,function (token,done) {
    let user = users.find((u) => u.id==token.id);
    if(!user)
    return done(null, false, { message: "Incorrect email or password" });
    else return done(null, user);
    });

    let strategyAdmin = new JWTStrategy(params,function (token, done) {
        let user1 = users.find((u) => u.id===token.id);
        if(!user1)
        return done(null, false, { message: "Incorrect username or password" });
        else if(user1.role!=='admin') return done(null,false,{message:"You do not have admin role"});
        else return done(null, user1);
        });

        passport.use("roleAll",strategyAll);
        passport.use("roleAdmin",strategyAdmin);

    app.post("/user", function(req,res){
        let {emailId,password} = req.body;
        let user = users.find((u) => u.emailId === emailId && u.password=== password);
        if(user){
            storeLogs("logsData.json",{...user,time:new Date(),login:true});
            let payload={id:user.id};
            let token=jwt.sign(payload,params.secretOrKey,{
                algorithm:"HS256",
                expiresIn:10000,
            });
            res.setHeader("Authorization",token);
            res.send({id:user.id,name:user.fname,role:user.role,token:token});
        }else res.sendStatus(401)
    });

    app.post("/wishlist",passport.authenticate("roleAll",{session:false}),function (req,res){
        let body=req.body;
        let index=wishList.findIndex(str=>str.id===req.user.id);
        if(index>=0) {
            let list=wishList[index];
            let idx=list.data.findIndex(str=>str.id===body.id);
            if(idx>=0) list.data.splice(idx,1);
            else list.data.push(body);
            wishList[index]=list;
            res.send(wishList[index]);
        }    
        else {
            let list={id:req.user.id,data:[body]};
            wishList.push(list);
            res.send(list);
        }
    });

    app.post("/orders",passport.authenticate("roleAll",{session:false}),function (req,res){
        let body=req.body;
        let index=cartList.findIndex(str=>str.id===req.user.id);
        if(index>=0) {
            let list=cartList[index];
            let idx=list.items.findIndex(str=>str.id===body.id);
            if(idx>=0) list.items.splice(idx,1);
            else {
                list.items=list.items.concat(body);
            }
            cartList[index]=list;
            res.send(cartList[index]);
        }    
        else {
            let list={id:req.user.id,items:body};
            cartList.push(list);
            res.send(list);
        }
    });

    app.post("/logout",passport.authenticate("roleAll",{session:false}),function(req,res){
        storeLogs("logsData.json",{...req.user,time:new Date(),login:false});
        res.send('Successfully Logged out...');
    })

    app.post("/product",passport.authenticate("roleAdmin",{session:false}),function (req,res){
        let body=req.body;
        mobiles.push(body);
        let data=mobiles.find(str=>str.id===body.id);
        if(data) res.send(data);
        else res.send('Something Went Wrong');
   });

   app.post("/upload",passport.authenticate("roleAdmin",{session:false}),function (req,res){
        let body=req.body;
        let mob=mobiles;
        mobiles=[...mob,...body];
        res.send(body);
    });

    app.get("/logs",passport.authenticate("roleAdmin",{session:false}),function (req,res){
        fs.readFile("logsData.json", "utf8",function(err,data){
            if(err) res.status(404).send(err);
            else res.send(data);
        });
    });

    app.get("/user",passport.authenticate("roleAll",{session:false}),function (req,res){
        res.send(req.user);
    });
    
    app.get("/orders",passport.authenticate("roleAll",{session:false}),function (req,res){
        let list=cartList.find(str=>str.id===req.user.id);
        let list1=list?list:{};
         res.send(list1);
    });

    app.get("/wishlist",passport.authenticate("roleAll",{session:false}),function (req,res){
        if(wishList.length>0){
            let list=wishList.find(str=>str.id===req.user.id);
            let { data=[] }=list;
            res.send(data);
        }else res.send([]);
    });

    app.get("/report",passport.authenticate("roleAdmin",{session:false}),function (req,res){
        let { fetch }=req.query;
        if(fetch === "mostAdded"){
            if(cartList.length>0){
                let data1=cartList.reduce((acc,curr)=>[...acc,curr.items],[]);
                let data2=data1.reduce((acc,curr)=>acc.find(str=>str.id===curr.id) ? acc : [...acc,curr] );
                let data=data2.map(ele=>({...ele,count:data1.reduce((acc,curr)=>curr.id===ele.id?acc+=1 : acc=1,0)}));
                res.send(data);
            }else res.send([]);
        }else if(fetch === "mostSearched"){
            if(searchHistory.length>0){
                let data=searchHistory.reduce((acc,curr)=>acc.find(str=>str.prod===curr)?
                acc : [...acc,{prod:curr,count:searchHistory.reduce((acc1,curr1)=>curr1===curr ? acc1+=1 :acc1,0)}],[]);
                res.send(data);
            }else res.send([]);
        }else if(fetch === "mostFavorite"){
            if(wishList.length>0){
                let data1=wishList.reduce((acc,curr)=>[...acc,curr.data],[]);
                let data2=data1.reduce((acc,curr)=>acc.find(str=>str.id===curr.id) ? acc : [...acc,curr] );
                let data=data2.map(ele=>({...ele,count:data1.reduce((acc,curr)=>curr.id===ele.id?acc+=1 : acc=1,0)}));
                res.send(data);
            }else res.send([]);
        }else if(fetch === "userLogs"){
            fs.readFile("logsData.json", "utf8",function(err,data){
                if(err) res.status(404).send(err);
                else{
                    res.send(data);
                }
            });
        }
   });

    app.get("/products",passport.authenticate("roleAdmin",{session:false}),function (req,res){
         res.send(mobiles);
    });

    app.post("/upload",passport.authenticate("roleAdmin",{session:false}),function (req,res){
        let body=req.body;
        let list=mobiles.concat(body);
        mobiles=list;
        res.send({"Total number of products present":mobiles.length, "Number of products edited":editDetails.length});
   });

    app.put("/product",passport.authenticate("roleAdmin",{session:false}),function (req,res){
        let body=req.body;
        console.log(body);
        let index=mobiles.findIndex(str=>str.id===body.id);
        if(index>=0) mobiles[index]=body;
        editDetails.push(body.id);
        res.send(mobiles[index]);
   });

app.get('/products/:category/:brand?',function(req,res){
    let { category,brand } = req.params;
    let { assured, ram,rating,price,sort,page,q }=req.query;
    let array=mobiles;
    if(ram) {
        let n=0;
        let arr=ram.split(',');
        arr.map(ele=>{
            if(ele=='<=4') n=n<4?4:n
            else if(ele=='<=3') n=n<3?3:n
            else if(ele=='<=2') n=n<2?2:n
        })
        array=array.filter(str=>arr.findIndex(name=>name=='>=6')>=0 && str.ram >=6 || str.ram<=n );
    }
    
    if(category) array=array.filter(str=>str.category.toLowerCase()===category.toLowerCase());
    if(brand) array=array.filter(str=>str.brand.toLowerCase()===brand.toLowerCase());
    if(assured) array=array.filter(str=>str.assured===true);
    
    if(rating) {
        let n=4;
        rating.split(',').map(ele=>{
            if(ele=='>4') n=n>4?4:n;
            else if(ele=='>3') n=n>3?3:n;
            else if(ele=='>2') n=n>2?2:n;
            else if(ele=='>1') n=n>1?1:n;
        })
        array=array.filter(str=>+str.rating>n);
    }
    if(price){
            let arr=price.split(',');
            array=array.filter(str=> arr.findIndex(name=>name=='>20000')>=0 && str.price>20000 ||
            arr.findIndex(name=>name==='0-5000')>=0 && (str.price>0 && str.price<=5000 ) ||
            arr.findIndex(name=>name==='5000-10000')>=0 && (str.price>5000 && str.price<=10000 ) ||
            arr.findIndex(name=>name==='10000-20000')>=0 && (str.price>10000 && str.price<=20000 )
            );
    }
    if(sort){
        if(sort==='asc') array=array.sort((p1,p2)=>p1.price-p2.price);
        else if(sort==='desc') array=array.sort((p1,p2)=>p2.price-p1.price);
        else array=array.sort((p1,p2)=>p1.popularity-p2.popularity);
    }
    if(q){
        searchHistory.push(q);
        array=array.filter(str=>str.name.toLowerCase().indexOf(q.toLowerCase())>=0 || 
        str.category.toLowerCase().indexOf(q.toLowerCase())>=0 || 
        str.brand.toLowerCase().indexOf(q.toLowerCase())>=0);
    }
    if(page){
        array=pagination(page,array);
    }
   
    res.send(array);
});

app.get('/',function(req,res){
    let array=randomArray(mobiles);
    res.send(array)
})

app.get('/product/:productId',function(req,res){
    let { productId }=req.params;
    let prod=mobiles.find(str=>str.id===productId);
    if(prod)
        res.send(prod);
    else res.status(404).send('No Product Found');
})

app.get('/pincode/:pincode/:productId',function(req,res){
    let { productId,pincode }=req.params;
    let pinIdx=pincodes.findIndex(str=>str.pincode==pincode);
    if(pinIdx>=0){
        let prod=pincodes[pinIdx].mobileList.find(str=>str.id===productId);
        if(prod) res.send(prod);
        else res.send({display:'Cannot be delivered to this region'});
    }
    else res.send({display:'Cannot be delivered to this region'});
})

app.get('/reviews/:productId',function(req,res){
    let { productId }=req.params;
    let prod=reviews.find(str=>str.mobileId===productId);
    if(prod)
        res.send(prod.ratings);
    else res.status(404).send('No reviews Found');
})

app.get('/product/pics/:productId',function(req,res){
    let { productId }=req.params;
    let prod=mobiles.find(str=>str.id===productId);
    if(prod){
        let pics=brandPics.find(str=>str.brand===prod.brand);
        if(pics) res.send(pics);
        else res.status(404).send('No Brand Pics Found')
    }
    else res.status(404).send('No Product Found');
})

function pagination(page,array){
    let startIndex=6*(page-1);
    let endIndex=(6*page)
    return array.slice(startIndex,endIndex);
}

function randomArray(arr){
    let array=[];
    for(let i=0;i<=13;i++){
        array.push(arr[Math.floor(Math.random()*arr.length)]);
    }
    return array;
}

function storeLogs(filename, data) {
    try {
       fs.access(filename,function(err){
        if(err){
            let data1=JSON.stringify([data])
            fs.writeFile(filename,data1,function(err){
                if(err) console.log(err);
            });
        }
        else{
            fs.readFile(filename,"utf8",function(err,data1){
                if(err) res.status(404).send(err);
                else{
                    let arr=JSON.parse(data1);
                    arr.unshift(data);
                    let data2=JSON.stringify(arr);
                    fs.writeFile(filename,data2,function(err){
                        if(err) console.log(err);
                    });
                }
            });
        }
       });
       
    } catch (err){
       console.log(err);
    }
  }